import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { draftPicks, players, teams, rules } from '@/schema';
import { eq, and, asc, sql, isNull } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { notifyDraftPick } from '@/lib/notify';
import { logSystemEvent } from '@/lib/db-helpers';
import { alias } from 'drizzle-orm/pg-core';
import { auth } from '@/auth';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { revalidateTag } from 'next/cache';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { overallPick, playerIdentity, playerName, playerPosition, newOwnerCode, coachName } = body;

    const leagueId = await getLeagueId();

    // Resolve current draft year so we scope pick lookup to the active year only
    const draftYearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, leagueId)))
      .limit(1);
    const draftYear = parseInt(draftYearRow[0]?.value || '0') || new Date().getFullYear();

    if (draftYear > new Date().getFullYear()) {
      return NextResponse.json({ error: `Draft year ${draftYear} is in the future — picks are not allowed until that year begins.` }, { status: 400 });
    }

    const completeRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, `draft_complete_${draftYear}`), eq(rules.leagueId, leagueId), isNull(rules.year)))
      .limit(1);
    if (completeRow[0]?.value === '1') {
      return NextResponse.json({ error: `The ${draftYear} draft is closed. No further picks are accepted.` }, { status: 400 });
    }

    // 1. Find the draft pick row by overall pick number, scoped to the current draft year
    const originalTeams = alias(teams, 'originalTeams');
    const currentTeams = alias(teams, 'currentTeams');

    const pickRows = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      year: draftPicks.year,
      originalTeam: originalTeams.name,
      currentOwner: currentTeams.name,
      currentTeamshort: currentTeams.teamshort,
      pickedAt: draftPicks.pickedAt,
      passed: draftPicks.passed,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear), eq(draftPicks.pick, parseInt(String(overallPick)))))
    .limit(1);

    if (!pickRows[0]) {
      return NextResponse.json({ error: `Pick #${overallPick} not found.` }, { status: 400 });
    }

    const pickRow = pickRows[0];

    // A pick is a "late selection" once it's been auto-skipped or voluntarily
    // passed — any authenticated user may submit it to help the owner. For
    // still-active picks, restrict to owner or admin/commissioner.
    const isLateSelection = pickRow.pickedAt !== null || pickRow.passed === true;
    if (!isLateSelection) {
      const callerTeamshort = (session.user as { id?: string }).id || '';
      const privileged = await isAdmin() || await isCommissioner();
      if (!privileged) {
        // Caller must match newOwnerCode (they are who they say they are)
        if (callerTeamshort.toLowerCase() !== (newOwnerCode || '').toLowerCase()) {
          return NextResponse.json({ error: 'Forbidden: you do not own this pick' }, { status: 403 });
        }
        // newOwnerCode must match the pick's actual current owner (prevents pick hijacking)
        if ((pickRow.currentTeamshort || '').toLowerCase() !== (newOwnerCode || '').toLowerCase()) {
          return NextResponse.json({ error: 'Forbidden: this pick belongs to a different team' }, { status: 403 });
        }
      }
    }

    // 2. Find the player in DB
    const playerRows = await db.select({ id: players.id })
      .from(players)
      .where(and(eq(players.identity, playerIdentity), eq(players.leagueId, leagueId)))
      .limit(1);

    if (!playerRows[0]) {
      return NextResponse.json({ error: 'Player not found.' }, { status: 400 });
    }

    const playerId = playerRows[0].id;
    const selectedPlayerName = `${playerPosition} - ${playerName}`;
    const now = new Date();

    // 3. Find new owner team ID
    const newTeamRow = await db.select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), sql`lower(${teams.teamshort}) = ${newOwnerCode.toLowerCase()}`))
      .limit(1);

    if (!newTeamRow[0]) {
      return NextResponse.json({ error: `Team not found: ${newOwnerCode}` }, { status: 400 });
    }

    // 4a. Roster limit check — team must have an active spot available
    const [rosterLimitRow, rosterCounts] = await Promise.all([
      db.select({ value: rules.value })
        .from(rules)
        .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'limit_roster')))
        .limit(1),
      db.select({
        total: sql<number>`cast(count(*) as int)`,
        ir: sql<number>`cast(sum(case when ${players.isIR} = true then 1 else 0 end) as int)`,
      })
      .from(players)
      .where(and(eq(players.leagueId, leagueId), eq(players.teamId, newTeamRow[0].id))),
    ]);
    const rosterLimit = parseInt(rosterLimitRow[0]?.value ?? '53');
    const total = Number(rosterCounts[0]?.total ?? 0);
    const ir = Number(rosterCounts[0]?.ir ?? 0);
    const active = total - ir;
    if (active >= rosterLimit) {
      return NextResponse.json({
        error: `${newOwnerCode} is at the roster limit (${active}/${rosterLimit} active). Waive or place a player on IR before drafting.`,
      }, { status: 400 });
    }

    // 4. Update draft pick: mark as selected
    await db.update(draftPicks)
      .set({
        playerId,
        selectedPlayerName,
        pickedAt: now,
        touch_id: coachName || 'draft',
      })
      .where(eq(draftPicks.id, pickRow.id));

    // 5. Update player's team ownership
    await db.update(players)
      .set({ teamId: newTeamRow[0].id, touch_id: coachName || 'draft' })
      .where(eq(players.id, playerId));

    // 6. Build notification context (recent 5 picks + next 3 on deck)
    const allPicks = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      selectedPlayerName: draftPicks.selectedPlayerName,
      pickedAt: draftPicks.pickedAt,
      passed: draftPicks.passed,
      currentOwner: currentTeams.name,
      originalTeam: originalTeams.name,
      playerId: draftPicks.playerId,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, pickRow.year!)))
    .orderBy(asc(draftPicks.pick));

    const currentIdx = allPicks.findIndex(p => p.pick === parseInt(String(overallPick)));
    const prevPick = currentIdx > 0 ? allPicks[currentIdx - 1] : null;
    const timeTakenMs = prevPick?.pickedAt ? now.getTime() - new Date(prevPick.pickedAt).getTime() : undefined;

    const recentPicks = allPicks
      .slice(Math.max(0, currentIdx - 5), currentIdx)
      .reverse()
      .map(p => ({
        round: p.round,
        pick: p.pick,
        player: p.selectedPlayerName || 'Skipped',
        owner: p.currentOwner || '',
        originalOwner: p.originalTeam || '',
      }));

    const onDeck = allPicks
      .slice(currentIdx + 1, currentIdx + 4)
      .filter(p => !p.playerId)
      .map(p => ({ round: p.round, pick: p.pick, owner: p.currentOwner || '', originalOwner: p.originalTeam || '' }));

    // Picks open for late selection: auto-skipped picks and unfilled passes.
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

    revalidateTag('draft-picks', 'max');
    await logSystemEvent(coachName || newOwnerCode, newOwnerCode, 'DRAFT_PICK', `R${pickRow.round} #${overallPick}: ${selectedPlayerName}`, leagueId);

    console.log('[draft-selection] notifying pick, leagueId:', leagueId);
    await notifyDraftPick({
      round: pickRow.round,
      overallPick: parseInt(String(overallPick)),
      currentOwner: pickRow.currentOwner || newOwnerCode,
      originalOwner: pickRow.originalTeam || '',
      playerName: selectedPlayerName,
      timeTakenMs,
      recentPicks,
      onDeck,
      skippedOpen,
      type: 'PICK',
      leagueId,
    }).catch(e => console.error('Draft notify failed:', e));

    return NextResponse.json({ success: true, notifyLeagueId: leagueId });
  } catch (error: unknown) {
    console.error('Draft selection error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
