import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { draftPicks, teams, rules } from '@/schema';
import { eq, and, asc } from 'drizzle-orm';
import { notifyDraftPick } from '@/lib/notify';
import { alias } from 'drizzle-orm/pg-core';

// Vercel sets CRON_SECRET automatically
function isAuthorized(req: Request) {
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if draft is active (any undrafted picks exist in draft_year)
    const draftYearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, 1)))
      .limit(1);

    const draftYear = parseInt(draftYearRow[0]?.value || '0');
    if (!draftYear) return NextResponse.json({ skipped: 'no draft_year configured' });

    const originalTeams = alias(teams, 'originalTeams');
    const currentTeams = alias(teams, 'currentTeams');

    const allPicks = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      playerId: draftPicks.playerId,
      selectedPlayerName: draftPicks.selectedPlayerName,
      pickedAt: draftPicks.pickedAt,
      warningSent: draftPicks.warningSent,
      currentOwner: currentTeams.name,
      originalTeam: originalTeams.name,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(eq(draftPicks.leagueId, 1), eq(draftPicks.year, draftYear)))
    .orderBy(asc(draftPicks.pick));

    // Find the active pick (first pick with no player AND no pickedAt)
    // Picks with pickedAt but no playerId are auto-skipped — don't re-process them
    const activeIdx = allPicks.findIndex(p => !p.playerId && !p.pickedAt);
    if (activeIdx === -1) return NextResponse.json({ skipped: 'draft complete' });

    const activePick = allPicks[activeIdx];
    const prevPick = activeIdx > 0 ? allPicks[activeIdx - 1] : null;

    // Clock starts when previous pick was made
    const clockStart = prevPick?.pickedAt ? new Date(prevPick.pickedAt) : null;
    if (!clockStart) return NextResponse.json({ skipped: 'no clock start time' });

    const now = new Date();
    const limitHours = activePick.round <= 2 ? 24 : 12;
    const expiryTime = new Date(clockStart.getTime() + limitHours * 60 * 60 * 1000);
    const diffMs = expiryTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const recentPicks = allPicks
      .slice(Math.max(0, activeIdx - 5), activeIdx)
      .reverse()
      .map(p => ({ round: p.round, pick: p.pick, player: p.selectedPlayerName || 'Skipped', owner: p.currentOwner || '' }));

    const onDeck = allPicks
      .slice(activeIdx + 1, activeIdx + 4)
      .filter(p => !p.playerId)
      .map(p => ({ round: p.round, pick: p.pick, owner: p.currentOwner || '' }));

    if (diffMs <= 0) {
      // Auto-skip: mark as expired
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
      });

      return NextResponse.json({ action: 'expired', pick: activePick.pick });
    }

    if (diffHours <= 1 && !activePick.warningSent) {
      // 1-hour warning
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
      });

      return NextResponse.json({ action: 'warning', pick: activePick.pick });
    }

    return NextResponse.json({ action: 'none', hoursRemaining: diffHours.toFixed(1) });
  } catch (error: unknown) {
    console.error('Draft cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
