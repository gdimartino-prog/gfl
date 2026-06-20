import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { draftPicks, teams, rules } from '@/schema';
import { eq, and, asc, gt, isNull } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { logSystemEvent } from '@/lib/db-helpers';
import { alias } from 'drizzle-orm/pg-core';
import { revalidateTag } from 'next/cache';
import { notifyDraftPick } from '@/lib/notify';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { overallPick, coachName } = await req.json();
    if (!overallPick) return NextResponse.json({ error: 'overallPick required' }, { status: 400 });

    const leagueId = await getLeagueId();

    const draftYearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, leagueId)))
      .limit(1);
    const draftYear = parseInt(draftYearRow[0]?.value || '0') || new Date().getFullYear();

    if (draftYear > new Date().getFullYear()) {
      return NextResponse.json({ error: `Draft year ${draftYear} is in the future — picks are not allowed until that year begins.` }, { status: 400 });
    }

    const currentTeams = alias(teams, 'currentTeams');
    const originalTeams = alias(teams, 'originalTeams');

    const pickRows = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      playerId: draftPicks.playerId,
      passed: draftPicks.passed,
      currentTeamId: draftPicks.currentTeamId,
      currentOwnerShort: currentTeams.teamshort,
      currentOwnerName: currentTeams.name,
      originalOwner: originalTeams.name,
    })
    .from(draftPicks)
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear), eq(draftPicks.pick, parseInt(String(overallPick)))))
    .limit(1);

    if (!pickRows[0]) return NextResponse.json({ error: `Pick #${overallPick} not found.` }, { status: 404 });

    const pick = pickRows[0];
    if (pick.playerId) return NextResponse.json({ error: 'Pick already made.' }, { status: 400 });

    // Verify caller owns this pick (checked before any early-return so ownership is always enforced)
    const callerTeamshort = (session.user as { id?: string }).id || '';
    const role = (session.user as { role?: string }).role || '';
    const isSuperuser = role === 'superuser' || role === 'admin';
    if (!isSuperuser && callerTeamshort.toLowerCase() !== (pick.currentOwnerShort || '').toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden: you do not own this pick' }, { status: 403 });
    }

    if (pick.passed) return NextResponse.json({ success: true, alreadyPassed: true });

    await db.update(draftPicks)
      .set({ passed: true, pickedAt: new Date(), touch_id: callerTeamshort || 'draft' })
      .where(eq(draftPicks.id, pick.id));

    // Cascade: mark all future unresolved picks for this team as passed too,
    // so the cron never expires them and they display as "Passed" immediately.
    if (pick.currentTeamId) {
      await db.update(draftPicks)
        .set({ passed: true, pickedAt: new Date(), touch_id: callerTeamshort || 'draft' })
        .where(and(
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.year, draftYear),
          eq(draftPicks.currentTeamId, pick.currentTeamId),
          gt(draftPicks.pick, pick.pick),
          isNull(draftPicks.playerId),
          isNull(draftPicks.selectedPlayerName),
          eq(draftPicks.passed, false),
        ));
    }

    await revalidateTag('draft-picks', 'max');
    await logSystemEvent(callerTeamshort || coachName || '', pick.currentOwnerShort || '', 'DRAFT_PASS', `R${pick.round} #${overallPick}: PASSED`, leagueId);

    // Build notification context — same pattern as draft-selection
    const allPicks = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      selectedPlayerName: draftPicks.selectedPlayerName,
      pickedAt: draftPicks.pickedAt,
      passed: draftPicks.passed,
      currentOwner: currentTeams.name,
      originalOwner: originalTeams.name,
      playerId: draftPicks.playerId,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear)))
    .orderBy(asc(draftPicks.pick));

    const currentIdx = allPicks.findIndex(p => p.pick === parseInt(String(overallPick)));

    const recentPicks = allPicks
      .slice(Math.max(0, currentIdx - 5), currentIdx)
      .reverse()
      .map(p => ({
        round: p.round, pick: p.pick,
        player: p.selectedPlayerName || 'Skipped',
        owner: p.currentOwner || '',
        originalOwner: p.originalOwner || '',
      }));

    const onDeck = allPicks
      .slice(currentIdx + 1, currentIdx + 4)
      .filter(p => !p.playerId && !p.passed)
      .map(p => ({ round: p.round, pick: p.pick, owner: p.currentOwner || '', originalOwner: p.originalOwner || '' }));

    const skippedOpen = allPicks
      .filter(p => !p.playerId && (
        (typeof p.selectedPlayerName === 'string' && p.selectedPlayerName.startsWith('SKIPPED')) ||
        p.passed
      ))
      .map(p => ({
        round: p.round, pick: p.pick,
        owner: p.currentOwner || '',
        skippedAt: p.pickedAt ? new Date(p.pickedAt) : null,
      }));

    await notifyDraftPick({
      round: pick.round,
      overallPick: parseInt(String(overallPick)),
      currentOwner: pick.currentOwnerName || pick.currentOwnerShort || callerTeamshort,
      originalOwner: pick.originalOwner || '',
      recentPicks,
      onDeck,
      skippedOpen,
      type: 'PASS',
      leagueId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Draft pass error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
