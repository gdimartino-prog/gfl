import { db } from '@/lib/db';
import { draftPicks, players, teams } from '@/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getLeagueId } from '@/lib/getLeagueId';
import { isAdmin } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  if (!await isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const year = parseInt(searchParams.get('year') ?? '');
  const draftType = searchParams.get('draftType') ?? 'free_agent';

  if (!year || isNaN(year)) {
    return Response.json({ error: 'year required' }, { status: 400 });
  }
  if (!['free_agent', 'rookie'].includes(draftType)) {
    return Response.json({ error: 'invalid draftType' }, { status: 400 });
  }

  const leagueId = await getLeagueId();

  const draftTeam = alias(teams, 'draft_team');
  const currentTeam = alias(teams, 'current_team');

  const allPicks = await db
    .select({
      round: draftPicks.round,
      pick: draftPicks.pick,
      draftTeamId: draftPicks.currentTeamId,
      draftTeamName: draftTeam.name,
      draftTeamShort: draftTeam.teamshort,
      playerName: players.name,
      playerPosition: players.position,
      playerIsIR: players.isIR,
      playerTeamId: players.teamId,
      currentTeamName: currentTeam.name,
      currentTeamShort: currentTeam.teamshort,
    })
    .from(draftPicks)
    .innerJoin(players, eq(draftPicks.playerId, players.id))
    .innerJoin(draftTeam, eq(draftPicks.currentTeamId, draftTeam.id))
    .leftJoin(currentTeam, eq(players.teamId, currentTeam.id))
    .where(and(
      eq(draftPicks.leagueId, leagueId),
      eq(draftPicks.year, year),
      eq(draftPicks.draftType, draftType),
      isNotNull(draftPicks.playerId),
      isNotNull(draftPicks.pickedAt),
    ))
    .orderBy(draftPicks.round, draftPicks.pick);

  const mismatched = allPicks
    .filter(p => p.playerTeamId !== p.draftTeamId)
    .map(p => ({
      round: p.round,
      pick: p.pick,
      draftTeamName: p.draftTeamName,
      draftTeamShort: p.draftTeamShort,
      playerName: p.playerName,
      playerPosition: p.playerPosition,
      isIR: p.playerIsIR,
      currentTeamName: p.currentTeamName,
      currentTeamShort: p.currentTeamShort,
      status: p.playerTeamId == null ? 'FA' : 'Wrong Team',
    }));

  return Response.json(mismatched, { headers: { 'Cache-Control': 'private, no-store' } });
}
