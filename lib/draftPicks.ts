
import { db } from './db';
import { draftPicks, teams, players } from '@/schema';
import { and, eq } from 'drizzle-orm';
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
  pickedAt: Date | null;
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
      pickedAt: draftPicks.pickedAt,
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