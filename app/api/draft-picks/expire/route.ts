import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { draftPicks, teams, rules } from '@/schema';
import { eq, and, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getLeagueId } from '@/lib/getLeagueId';
import { notifyDraftPick } from '@/lib/notify';
import { getDraftStartDate, computePickTimings } from '@/lib/draftClock';
import { revalidateTag } from 'next/cache';

export async function POST() {
  const session = await auth();
  // Require auth — any coach can trigger this, but the server-side time check prevents
  // premature expiry. The cron job at /api/cron/draft is the authoritative expiry handler.
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const leagueId = await getLeagueId();

    const draftYearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, leagueId)))
      .limit(1);

    const draftYear = parseInt(draftYearRow[0]?.value || '0');
    if (!draftYear) return NextResponse.json({ skipped: 'no draft_year configured' });
    if (draftYear > new Date().getFullYear()) return NextResponse.json({ skipped: `draft_year ${draftYear} is in the future` });

    const originalTeams = alias(teams, 'originalTeams');
    const currentTeams = alias(teams, 'currentTeams');

    const allPicks = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      playerId: draftPicks.playerId,
      selectedPlayerName: draftPicks.selectedPlayerName,
      pickedAt: draftPicks.pickedAt,
      passed: draftPicks.passed,
      currentOwner: currentTeams.name,
      originalTeam: originalTeams.name,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear)))
    .orderBy(asc(draftPicks.pick));

    const activeIdx = allPicks.findIndex(p => !p.playerId && !p.pickedAt && !p.passed);
    if (activeIdx === -1) return NextResponse.json({ skipped: 'draft complete' });

    const activePick = allPicks[activeIdx];

    const draftStartDate = await getDraftStartDate(leagueId);
    const now = new Date();
    if (draftStartDate && now < draftStartDate) {
      return NextResponse.json({ skipped: 'before draft start date' });
    }

    // Use the full chain computation — the simplified prevPick.pickedAt approach
    // breaks when the previous pick is a passed/stale/instant-skip with an old timestamp.
    const timings = await computePickTimings(
      allPicks.map(p => ({
        id: p.id, round: p.round, pick: p.pick,
        scheduledAt: null,
        pickedAt: p.pickedAt ? new Date(p.pickedAt) : null,
        passed: p.passed ?? false,
        selectedPlayerName: p.selectedPlayerName,
      })),
      leagueId,
      draftStartDate,
    );

    const timing = timings.get(activePick.id);
    if (!timing) return NextResponse.json({ skipped: 'no timing computed' });

    if (now < timing.deadline) {
      return NextResponse.json({ skipped: 'not expired yet' });
    }

    await db.update(draftPicks)
      .set({ selectedPlayerName: 'SKIPPED (Time Expired)', pickedAt: now, touch_id: 'client-expire' })
      .where(eq(draftPicks.id, activePick.id));
    // Board changed — without this the skip stays invisible for up to 30s.
    revalidateTag('draft-picks', 'max');

    const recentPicks = allPicks
      .slice(Math.max(0, activeIdx - 5), activeIdx)
      .reverse()
      .map(p => ({ round: p.round, pick: p.pick, player: p.selectedPlayerName || 'Skipped', owner: p.currentOwner || '' }));

    const onDeck = allPicks
      .filter(p => p.pick > activePick.pick && !p.playerId && !p.passed && !(typeof p.selectedPlayerName === 'string' && p.selectedPlayerName.startsWith('SKIPPED')))
      .slice(0, 3)
      .map(p => ({ round: p.round, pick: p.pick, owner: p.currentOwner || '', originalOwner: p.originalTeam || '' }));

    // Picks that were auto-skipped and still have no player — coaches can
    // submit a late selection for any of them via the draft board.
    const skippedOpen = allPicks
      .filter(p => !p.playerId && (
        (typeof p.selectedPlayerName === 'string' && p.selectedPlayerName.startsWith('SKIPPED')) ||
        p.passed
      ))
      .map(p => ({
        round: p.round,
        pick: p.pick,
        owner: p.currentOwner || '',
        skippedAt: p.pickedAt ? new Date(p.pickedAt) : null,
      }));

    await notifyDraftPick({
      round: activePick.round,
      overallPick: activePick.pick,
      currentOwner: activePick.currentOwner || '',
      originalOwner: activePick.originalTeam || '',
      recentPicks,
      onDeck,
      skippedOpen,
      type: 'EXPIRATION',
      leagueId,
    }).catch(e => console.error('Expire notify failed:', e));

    return NextResponse.json({ expired: true, pick: activePick.pick });
  } catch (error) {
    console.error('Draft expire error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
