import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { draftPicks, teams, rules } from '@/schema';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { notifyDraftPick } from '@/lib/notify';
import { alias } from 'drizzle-orm/pg-core';
import { getDraftClockMinutes, getWarningThresholdMinutes, getDraftStartDate } from '@/lib/draftClock';

function isAuthorized(req: Request) {
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all leagues that have a draft_year configured
    const draftYearRules = await db
      .select({ leagueId: rules.leagueId, value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), isNull(rules.year)));

    const results = [];

    for (const draftYearRule of draftYearRules) {
      const leagueId = draftYearRule.leagueId;
      if (!leagueId) continue;
      const draftYear = parseInt(draftYearRule.value || '0');
      if (!draftYear) continue;

      const originalTeams = alias(teams, 'originalTeams');
      const currentTeams = alias(teams, 'currentTeams');

      const allPicks = await db.select({
        id: draftPicks.id,
        round: draftPicks.round,
        pick: draftPicks.pick,
        playerId: draftPicks.playerId,
        passed: draftPicks.passed,
        selectedPlayerName: draftPicks.selectedPlayerName,
        scheduledAt: draftPicks.scheduledAt,
        pickedAt: draftPicks.pickedAt,
        warningSent: draftPicks.warningSent,
        currentOwner: currentTeams.name,
        originalTeam: originalTeams.name,
      })
      .from(draftPicks)
      .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
      .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
      .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear)))
      .orderBy(asc(draftPicks.pick));

      // Active pick: first pick with no player, no pickedAt, and not passed
      const activeIdx = allPicks.findIndex(p => !p.playerId && !p.pickedAt && !p.passed);
      if (activeIdx === -1) {
        results.push({ leagueId, skipped: 'draft complete or not started' });
        continue;
      }

      const activePick = allPicks[activeIdx];
      const prevPick = activeIdx > 0 ? allPicks[activeIdx - 1] : null;

      // If the official draft start date hasn't arrived yet, hold the clock
      const draftStartDate = await getDraftStartDate(leagueId);
      const now = new Date();
      if (draftStartDate && now < draftStartDate) {
        results.push({ leagueId, skipped: 'before draft start date', draftStartDate });
        continue;
      }

      // If the pick has a scheduled start time that hasn't arrived yet, skip
      if (activePick.scheduledAt && activePick.scheduledAt > now) {
        results.push({ leagueId, skipped: 'pick not yet scheduled', scheduledAt: activePick.scheduledAt });
        continue;
      }

      const rawClockStart = prevPick?.pickedAt ? new Date(prevPick.pickedAt) : activePick.scheduledAt ? new Date(activePick.scheduledAt) : null;
      if (!rawClockStart) {
        results.push({ leagueId, skipped: 'no clock start time' });
        continue;
      }
      // Clock starts from the later of: when previous pick was made OR the official start date
      const clockStart = draftStartDate && rawClockStart < draftStartDate ? draftStartDate : rawClockStart;

      const clockMinutes = await getDraftClockMinutes(leagueId, activePick.round);
      const warningMinutes = getWarningThresholdMinutes(clockMinutes);

      const expiryTime = new Date(clockStart.getTime() + clockMinutes * 60 * 1000);
      const diffMs = expiryTime.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      const recentPicks = allPicks
        .slice(Math.max(0, activeIdx - 5), activeIdx)
        .reverse()
        .map(p => ({ round: p.round, pick: p.pick, player: p.selectedPlayerName || 'Skipped', owner: p.currentOwner || '' }));

      const onDeck = allPicks
        .slice(activeIdx + 1, activeIdx + 4)
        .filter(p => !p.playerId && !p.passed)
        .map(p => ({ round: p.round, pick: p.pick, owner: p.currentOwner || '', originalOwner: p.originalTeam || '' }));

      if (diffMs <= 0) {
        await db.update(draftPicks)
          .set({ selectedPlayerName: 'SKIPPED (Time Expired)', pickedAt: now, touch_id: 'cron-auto-skip' })
          .where(eq(draftPicks.id, activePick.id));

        await notifyDraftPick({
          round: activePick.round,
          overallPick: activePick.pick,
          currentOwner: activePick.currentOwner || '',
          originalOwner: activePick.originalTeam || '',
          recentPicks, onDeck,
          type: 'EXPIRATION',
          leagueId,
        });

        results.push({ leagueId, action: 'expired', pick: activePick.pick });
        continue;
      }

      if (diffMinutes <= warningMinutes && !activePick.warningSent) {
        await db.update(draftPicks)
          .set({ warningSent: true })
          .where(eq(draftPicks.id, activePick.id));

        await notifyDraftPick({
          round: activePick.round,
          overallPick: activePick.pick,
          currentOwner: activePick.currentOwner || '',
          originalOwner: activePick.originalTeam || '',
          recentPicks, onDeck,
          type: 'WARNING',
          leagueId,
        });

        results.push({ leagueId, action: 'warning', pick: activePick.pick, minutesRemaining: diffMinutes.toFixed(1) });
        continue;
      }

      results.push({ leagueId, action: 'none', minutesRemaining: diffMinutes.toFixed(1) });
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error('Draft cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
