import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { draftPicks, teams, rules } from '@/schema';
import { eq, and, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getLeagueId } from '@/lib/getLeagueId';
import { notifyDraftPick } from '@/lib/notify';
import { getDraftClockMinutes, getDraftStartDate } from '@/lib/draftClock';

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const leagueId = await getLeagueId();

    const draftYearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, leagueId)))
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
      currentOwner: currentTeams.name,
      originalTeam: originalTeams.name,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear)))
    .orderBy(asc(draftPicks.pick));

    const activeIdx = allPicks.findIndex(p => !p.playerId && !p.pickedAt);
    if (activeIdx === -1) return NextResponse.json({ skipped: 'draft complete' });

    const activePick = allPicks[activeIdx];
    const prevPick = activeIdx > 0 ? allPicks[activeIdx - 1] : null;

    // Don't expire if the official draft start date hasn't passed yet
    const draftStartDate = await getDraftStartDate(leagueId);
    const now = new Date();
    if (draftStartDate && now < draftStartDate) {
      return NextResponse.json({ skipped: 'before draft start date' });
    }

    const rawClockStart = prevPick?.pickedAt ? new Date(prevPick.pickedAt) : null;
    if (!rawClockStart) return NextResponse.json({ skipped: 'no clock start' });

    // Clock starts from the later of: when previous pick was made OR the official start date
    const clockStart = draftStartDate && rawClockStart < draftStartDate ? draftStartDate : rawClockStart;

    const clockMinutes = await getDraftClockMinutes(leagueId, activePick.round);
    const expiryTime = new Date(clockStart.getTime() + clockMinutes * 60 * 1000);

    if (now < expiryTime) {
      return NextResponse.json({ skipped: 'not expired yet' });
    }

    await db.update(draftPicks)
      .set({ selectedPlayerName: 'SKIPPED (Time Expired)', pickedAt: now, touch_id: 'client-expire' })
      .where(eq(draftPicks.id, activePick.id));

    const recentPicks = allPicks
      .slice(Math.max(0, activeIdx - 5), activeIdx)
      .reverse()
      .map(p => ({ round: p.round, pick: p.pick, player: p.selectedPlayerName || 'Skipped', owner: p.currentOwner || '' }));

    const onDeck = allPicks
      .slice(activeIdx + 1, activeIdx + 4)
      .filter(p => !p.playerId)
      .map(p => ({ round: p.round, pick: p.pick, owner: p.currentOwner || '', originalOwner: p.originalTeam || '' }));

    await notifyDraftPick({
      round: activePick.round,
      overallPick: activePick.pick,
      currentOwner: activePick.currentOwner || '',
      originalOwner: activePick.originalTeam || '',
      recentPicks,
      onDeck,
      type: 'EXPIRATION',
      leagueId,
    }).catch(e => console.error('Expire notify failed:', e));

    return NextResponse.json({ expired: true, pick: activePick.pick });
  } catch (error) {
    console.error('Draft expire error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
