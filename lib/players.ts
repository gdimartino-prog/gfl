
import { db } from './db';
import { players, teams } from '@/schema';
import { eq } from 'drizzle-orm';
import { cache } from 'react';

export type Player = {
  id: number;
  name: string;
  position: string | null;
  teamId?: number | null;
  touch_id?: string | null;
};

/**
 * Fetches all players from the database with caching.
 * Returns data in the same shape as the Google Sheets parser for API compatibility.
 */
const _getPlayers = cache(async (leagueId: number) => {
    const rows = await db.select({
      id: players.id,
      name: players.name,
      first: players.first,
      last: players.last,
      age: players.age,
      position: players.position,
      offense: players.offense,
      defense: players.defense,
      special: players.special,
      identity: players.identity,
      isIR: players.isIR,
      overall: players.overall,
      runBlock: players.runBlock,
      passBlock: players.passBlock,
      rushYards: players.rushYards,
      interceptionsVal: players.interceptionsVal,
      sacksVal: players.sacksVal,
      durability: players.durability,
      scouting: players.scouting,
      teamShort: teams.teamshort,
      teamName: teams.name,
    })
    .from(players)
    .leftJoin(teams, eq(players.teamId, teams.id))
    .where(eq(players.leagueId, leagueId));

    return rows.map(p => ({
      ...p,
      team: p.teamShort ?? 'FA',
      run: p.runBlock ?? '0',
      pass: p.passBlock ?? '0',
      rush: p.rushYards ?? '0',
      int: p.interceptionsVal ?? '0',
      sack: p.sacksVal ?? '0',
      dur: p.durability ?? '0',
    }));
});

export async function getPlayers(leagueId: number = 1): Promise<unknown[]> {
  try {
    return await _getPlayers(leagueId);
  } catch (err) {
    console.error('getPlayers Error:', err);
    return [];
  }
}

/**
 * Fetches a single player by their ID.
 */
export async function getPlayerById(id: number): Promise<Player | undefined> {
  return await db.query.players.findFirst({
    where: eq(players.id, id),
  });
}

/**
 * Creates a new player.
 */
export async function createPlayer(player: Omit<Player, 'id'>, coachName: string) {
  await db.insert(players).values({
    ...player,
    touch_id: coachName,
  });
}

/**
 * Updates an existing player.
 */
export async function updatePlayer(id: number, player: Partial<Omit<Player, 'id'>>, coachName: string) {
  await db.update(players).set({
    ...player,
    touch_id: coachName,
  }).where(eq(players.id, id));
}

/**
 * Deletes a player.
 */
export async function deletePlayer(id: number) {
  await db.delete(players).where(eq(players.id, id));
}
