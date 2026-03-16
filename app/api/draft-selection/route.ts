import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { draftPicks, players, teams } from '@/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { notifyDraftPick } from '@/lib/notify';
import { logSystemEvent } from '@/lib/db-helpers';
import { alias } from 'drizzle-orm/pg-core';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { overallPick, playerIdentity, playerName, playerPosition, newOwnerCode, coachName } = body;

    const leagueId = await getLeagueId();

    // 1. Find the draft pick row by overall pick number
    const originalTeams = alias(teams, 'originalTeams');
    const currentTeams = alias(teams, 'currentTeams');

    const pickRows = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      originalTeam: originalTeams.name,
      currentOwner: currentTeams.name,
      pickedAt: draftPicks.pickedAt,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.pick, parseInt(String(overallPick)))))
    .limit(1);

    if (!pickRows[0]) {
      return NextResponse.json({ error: `Pick #${overallPick} not found.` }, { status: 400 });
    }

    const pickRow = pickRows[0];

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
      .where(and(eq(teams.leagueId, leagueId), eq(teams.teamshort, newOwnerCode)))
      .limit(1);

    if (!newTeamRow[0]) {
      return NextResponse.json({ error: `Team not found: ${newOwnerCode}` }, { status: 400 });
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
      currentOwner: currentTeams.name,
      originalTeam: originalTeams.name,
      playerId: draftPicks.playerId,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(eq(draftPicks.leagueId, leagueId))
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
      }));

    const onDeck = allPicks
      .slice(currentIdx + 1, currentIdx + 4)
      .filter(p => !p.playerId)
      .map(p => ({ round: p.round, pick: p.pick, owner: p.currentOwner || '' }));

    logSystemEvent(coachName || newOwnerCode, newOwnerCode, 'DRAFT_PICK', `R${pickRow.round} #${overallPick}: ${selectedPlayerName}`);

    // Fire-and-forget notification
    notifyDraftPick({
      round: pickRow.round,
      overallPick: parseInt(String(overallPick)),
      currentOwner: pickRow.currentOwner || newOwnerCode,
      originalOwner: pickRow.originalTeam || '',
      playerName: selectedPlayerName,
      timeTakenMs,
      recentPicks,
      onDeck,
      type: 'PICK',
      leagueId,
    }).catch(e => console.error('Draft notify failed:', e));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Draft selection error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
