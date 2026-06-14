import { db } from '@/lib/db';
import { draftAutoPickQueue, players, teams } from '@/schema';
import { eq, and, asc, isNull, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

export interface QueueItem {
  id: number;
  playerId: number;
  playerName: string;
  position: string | null;
  sortOrder: number;
}

export interface BestAutoPick {
  queueId: number;
  playerId: number;
  playerName: string;
}

export async function getAutoPickQueue(
  leagueId: number,
  teamId: number,
  year: number,
  draftType = 'free_agent',
): Promise<QueueItem[]> {
  const rows = await db
    .select({
      id: draftAutoPickQueue.id,
      playerId: draftAutoPickQueue.playerId,
      playerName: players.name,
      position: players.position,
      sortOrder: draftAutoPickQueue.sortOrder,
    })
    .from(draftAutoPickQueue)
    .innerJoin(players, and(
      eq(draftAutoPickQueue.playerId, players.id),
      isNull(players.teamId),
    ))
    .where(and(
      eq(draftAutoPickQueue.leagueId, leagueId),
      eq(draftAutoPickQueue.teamId, teamId),
      eq(draftAutoPickQueue.year, year),
      eq(draftAutoPickQueue.draftType, draftType),
    ))
    .orderBy(asc(draftAutoPickQueue.sortOrder));

  return rows;
}

export async function addToAutoPickQueue(
  leagueId: number,
  teamId: number,
  playerId: number,
  year: number,
  draftType = 'free_agent',
  touchId = '',
): Promise<void> {
  const maxRow = await db
    .select({ maxSort: sql<number>`coalesce(max(${draftAutoPickQueue.sortOrder}), -1)` })
    .from(draftAutoPickQueue)
    .where(and(
      eq(draftAutoPickQueue.leagueId, leagueId),
      eq(draftAutoPickQueue.teamId, teamId),
      eq(draftAutoPickQueue.year, year),
      eq(draftAutoPickQueue.draftType, draftType),
    ));

  const nextSort = (maxRow[0]?.maxSort ?? -1) + 1;

  await db.insert(draftAutoPickQueue).values({
    leagueId,
    teamId,
    playerId,
    year,
    draftType,
    sortOrder: nextSort,
    touch_id: touchId,
  }).onConflictDoNothing();
}

export async function removeFromAutoPickQueue(
  leagueId: number,
  teamId: number,
  playerId: number,
  year: number,
  draftType = 'free_agent',
): Promise<void> {
  await db.delete(draftAutoPickQueue).where(and(
    eq(draftAutoPickQueue.leagueId, leagueId),
    eq(draftAutoPickQueue.teamId, teamId),
    eq(draftAutoPickQueue.playerId, playerId),
    eq(draftAutoPickQueue.year, year),
    eq(draftAutoPickQueue.draftType, draftType),
  ));
}

export async function reorderAutoPickQueue(
  leagueId: number,
  teamId: number,
  year: number,
  draftType = 'free_agent',
  items: { playerId: number; sortOrder: number }[],
): Promise<void> {
  await Promise.all(items.map(item =>
    db.update(draftAutoPickQueue)
      .set({ sortOrder: item.sortOrder, touch_dt: new Date() })
      .where(and(
        eq(draftAutoPickQueue.leagueId, leagueId),
        eq(draftAutoPickQueue.teamId, teamId),
        eq(draftAutoPickQueue.playerId, item.playerId),
        eq(draftAutoPickQueue.year, year),
        eq(draftAutoPickQueue.draftType, draftType),
      ))
  ));
}

// Returns the top queued player who is still a free agent (teamId IS NULL).
// Called by the draft cron to fire auto-picks.
export async function findBestAutoPick(
  leagueId: number,
  teamId: number,
  year: number,
  draftType = 'free_agent',
): Promise<BestAutoPick | null> {
  const rows = await db
    .select({
      id: draftAutoPickQueue.id,
      playerId: draftAutoPickQueue.playerId,
      playerName: players.name,
    })
    .from(draftAutoPickQueue)
    .innerJoin(players, and(
      eq(draftAutoPickQueue.playerId, players.id),
      isNull(players.teamId),
    ))
    .where(and(
      eq(draftAutoPickQueue.leagueId, leagueId),
      eq(draftAutoPickQueue.teamId, teamId),
      eq(draftAutoPickQueue.year, year),
      eq(draftAutoPickQueue.draftType, draftType),
    ))
    .orderBy(asc(draftAutoPickQueue.sortOrder))
    .limit(1);

  if (!rows[0]) return null;
  return { queueId: rows[0].id, playerId: rows[0].playerId, playerName: rows[0].playerName };
}

// After a player is drafted, remove them from every team's queue for this draft.
export async function purgePickedPlayerFromQueues(
  leagueId: number,
  playerId: number,
  year: number,
  draftType = 'free_agent',
): Promise<void> {
  await db.delete(draftAutoPickQueue).where(and(
    eq(draftAutoPickQueue.leagueId, leagueId),
    eq(draftAutoPickQueue.playerId, playerId),
    eq(draftAutoPickQueue.year, year),
    eq(draftAutoPickQueue.draftType, draftType),
  ));
}

// Resolve a team's DB id from their teamshort (case-insensitive). Cached since teamshort is immutable.
const _resolveTeamId = unstable_cache(
  async (leagueId: number, teamshort: string): Promise<number | null> => {
    const rows = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(
        eq(teams.leagueId, leagueId),
        eq(sql`lower(${teams.teamshort})`, teamshort),
      ))
      .limit(1);
    return rows[0]?.id ?? null;
  },
  ['resolve-team-id'],
  { revalidate: 3600, tags: ['teams'] },
);

export async function resolveTeamId(leagueId: number, teamshort: string): Promise<number | null> {
  return _resolveTeamId(leagueId, teamshort.toLowerCase());
}
