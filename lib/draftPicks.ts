
import { db } from './db';
import { draftPicks, teams, players } from '@/schema';
import { and, eq, isNotNull, asc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { cache } from 'react';

export type DraftPick = {
  id: number;
  year: number;
  round: number;
  pick: number;
  originalTeamId: number;
  currentTeamId: number;
  playerId?: number | null;
  touch_id?: string | null;
};

export type DraftPickRow = {
  id: number;
  year: number | null;
  round: number;
  pick: number;
  overall?: number;
  originalTeam: string | null;
  currentOwner: string | null;
  selectedPlayer: string | null;
  selectedPlayerName: string | null;
  pickedAt: Date | null;
  passed: boolean;
};

const _getAllDraftPicks = cache(async (leagueId: number) => {
  try {
    const originalTeams = alias(teams, 'originalTeams');
    const currentTeams = alias(teams, 'currentTeams');

    return await db.select({
      id: draftPicks.id,
      year: draftPicks.year,
      round: draftPicks.round,
      pick: draftPicks.pick,
      originalTeam: originalTeams.teamshort,
      currentOwner: currentTeams.teamshort,
      selectedPlayer: players.name,
      selectedPlayerName: draftPicks.selectedPlayerName,
      pickedAt: draftPicks.pickedAt,
      passed: draftPicks.passed,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .leftJoin(players, eq(draftPicks.playerId, players.id))
    .where(eq(draftPicks.leagueId, leagueId));
  } catch (error) {
    console.error('getAllDraftPicks failed:', error);
    return [];
  }
});

/**
 * Get all draft picks with full details for a given league
 */
export async function getAllDraftPicks(leagueId: number = 1): Promise<DraftPickRow[]> {
  return _getAllDraftPicks(leagueId);
}

/**
 * Find a specific pick using Year, Round, and the Current Owner
 */
export async function findDraftPick(
  currentOwnerId: number,
  year: number,
  round: number,
  pick?: number
) {
    return await db.query.draftPicks.findFirst({
        where: and(
            eq(draftPicks.currentTeamId, currentOwnerId),
            eq(draftPicks.year, year),
            eq(draftPicks.round, round),
            pick ? eq(draftPicks.pick, pick) : undefined,
        )
    });
}

/**
 * Transfer a draft pick by updating the 'Current Owner'
 */
export async function transferDraftPick(
  pickId: number,
  toTeamId: number,
  coachName: string
) {
    await db.update(draftPicks).set({
        currentTeamId: toTeamId,
        touch_id: coachName,
    }).where(eq(draftPicks.id, pickId));
}

/**
 * Saves a player selection to the database
 */
export async function updateDraftPick(
  pickId: number,
  playerId: number,
  coachName: string
) {
    await db.update(draftPicks).set({
        playerId: playerId,
        touch_id: coachName,
    }).where(eq(draftPicks.id, pickId));
}

/**
 * Clear a single pick selection (commissioner or coach undo)
 */
export async function clearPickSelection(pickId: number, clearedBy: string) {
  const pick = await db.select({
    playerId: draftPicks.playerId,
    selectedPlayerName: draftPicks.selectedPlayerName,
  }).from(draftPicks).where(eq(draftPicks.id, pickId)).limit(1);

  console.log('[clearPickSelection] pickId:', pickId, '| playerId:', pick[0]?.playerId, '| playerName:', pick[0]?.selectedPlayerName);

  if (pick[0]?.playerId) {
    try {
      await db.update(players)
        .set({ teamId: sql`NULL`, touch_id: clearedBy })
        .where(eq(players.id, pick[0].playerId));
      console.log('[clearPickSelection] player teamId cleared for playerId:', pick[0].playerId);
    } catch (err) {
      console.error('[clearPickSelection] ERROR clearing player teamId:', err);
    }
  } else {
    console.warn('[clearPickSelection] No playerId on pick — player teamId not cleared. selectedPlayerName:', pick[0]?.selectedPlayerName);
  }

  await db.update(draftPicks)
    .set({ playerId: null, selectedPlayerName: null, pickedAt: null, touch_id: clearedBy })
    .where(eq(draftPicks.id, pickId));
}

/**
 * Clear all pick selections for a league/year (commissioner reset)
 */
export async function clearAllPickSelections(leagueId: number, year: number, clearedBy: string) {
  const made = await db.select({ id: draftPicks.id, playerId: draftPicks.playerId })
    .from(draftPicks)
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, year), isNotNull(draftPicks.playerId)));

  for (const p of made) {
    if (p.playerId) {
      await db.update(players)
        .set({ teamId: sql`NULL`, touch_id: clearedBy })
        .where(eq(players.id, p.playerId));
    }
  }

  await db.update(draftPicks)
    .set({ playerId: null, selectedPlayerName: null, pickedAt: null, touch_id: clearedBy })
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, year), isNotNull(draftPicks.playerId)));
}

/**
 * Get the last finalized pick for a specific team in the current draft
 */
export async function getLastPickForTeam(teamId: number, leagueId: number, year: number) {
  const rows = await db.select()
    .from(draftPicks)
    .where(and(
      eq(draftPicks.leagueId, leagueId),
      eq(draftPicks.year, year),
      eq(draftPicks.currentTeamId, teamId),
      isNotNull(draftPicks.playerId),
    ))
    .orderBy(asc(draftPicks.pick));

  return rows.length > 0 ? rows[rows.length - 1] : null;
}

/**
 * Get the team ID currently on the clock (first unpicked slot)
 */
export async function getNextOnClockTeamId(leagueId: number, year: number) {
  const row = await db.select({ currentTeamId: draftPicks.currentTeamId })
    .from(draftPicks)
    .where(and(
      eq(draftPicks.leagueId, leagueId),
      eq(draftPicks.year, year),
      eq(draftPicks.playerId, null as unknown as number),
    ))
    .orderBy(asc(draftPicks.pick))
    .limit(1);

  return row[0]?.currentTeamId ?? null;
}