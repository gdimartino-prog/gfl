
import { db } from './db';
import { players, teams } from '@/schema';
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

export type Player = {
  id: number;
  leagueId: number;
  name: string;
  position: string | null;
  teamId?: number | null;
  touch_id?: string | null;
};

const sharedSelect = {
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
  teamShort: teams.teamshort,
  teamName: teams.name,
};

const mapRow = (p: typeof sharedSelect & { teamShort: string | null; runBlock: string | null; passBlock: string | null; rushYards: string | null; interceptionsVal: string | null; sacksVal: string | null; durability: string | null; scouting?: Record<string, string> | null }) => ({
  ...p,
  team: p.teamShort ?? 'FA',
  run: p.runBlock ?? '0',
  pass: p.passBlock ?? '0',
  rush: p.rushYards ?? '0',
  int: p.interceptionsVal ?? '0',
  sack: p.sacksVal ?? '0',
  dur: p.durability ?? '0',
});

// Lean query — no scouting column. Used by rosters, draft board, players list.
const _getPlayers = unstable_cache(async (leagueId: number) => {
  const rows = await db.select(sharedSelect)
    .from(players)
    .leftJoin(teams, eq(players.teamId, teams.id))
    .where(eq(players.leagueId, leagueId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map(p => mapRow(p as any));
}, ['players-lean'], { revalidate: 300, tags: ['players'] });

// Full query — includes scouting JSON. Too large for unstable_cache (>2MB);
// rely on CDN Cache-Control headers at the API route level instead.
async function _getPlayersWithScouting(leagueId: number) {
  const rows = await db.select({ ...sharedSelect, scouting: players.scouting })
    .from(players)
    .leftJoin(teams, eq(players.teamId, teams.id))
    .where(eq(players.leagueId, leagueId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map(p => mapRow(p as any));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPlayers(leagueId: number = 1): Promise<any[]> {
  try {
    return await _getPlayers(leagueId);
  } catch (err) {
    console.error('getPlayers Error:', err);
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPlayersWithScouting(leagueId: number = 1): Promise<any[]> {
  try {
    return await _getPlayersWithScouting(leagueId);
  } catch (err) {
    console.error('getPlayersWithScouting Error:', err);
    return [];
  }
}

export async function getPlayerById(id: number): Promise<Player | undefined> {
  return await db.query.players.findFirst({
    where: eq(players.id, id),
  });
}

export async function createPlayer(player: Omit<Player, 'id'>, coachName: string) {
  await db.insert(players).values({
    ...player,
    touch_id: coachName,
  });
}

export async function updatePlayer(id: number, player: Partial<Omit<Player, 'id'>>, coachName: string) {
  await db.update(players).set({
    ...player,
    touch_id: coachName,
  }).where(eq(players.id, id));
}

export async function deletePlayer(id: number) {
  await db.delete(players).where(eq(players.id, id));
}
