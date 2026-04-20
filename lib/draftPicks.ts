
import { db } from './db';
import { draftPicks, pickTransfers, teams, players } from '@/schema';
import { and, eq, isNotNull, asc, sql, or } from 'drizzle-orm';
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
  draftType: string;
  overall?: number;
  originalTeam: string | null;
  currentOwner: string | null;
  selectedPlayer: string | null;
  selectedPlayerName: string | null;
  selectedPlayerPosition: string | null;
  scheduledAt: Date | null;
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
      draftType: draftPicks.draftType,
      originalTeam: originalTeams.teamshort,
      currentOwner: currentTeams.teamshort,
      selectedPlayer: players.name,
      selectedPlayerName: draftPicks.selectedPlayerName,
      selectedPlayerPosition: players.position,
      scheduledAt: draftPicks.scheduledAt,
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
    .set({ playerId: null, selectedPlayerName: null, pickedAt: null, passed: false, touch_id: clearedBy })
    .where(eq(draftPicks.id, pickId));
}

/**
 * Clear all pick selections for a league/year (commissioner reset).
 * Optionally scope to a specific draftType.
 */
export async function clearAllPickSelections(leagueId: number, year: number, clearedBy: string, draftType?: string) {
  const baseWhere = draftType
    ? and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, year), eq(draftPicks.draftType, draftType))
    : and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, year));

  // First free up any rostered players from these picks
  const made = await db.select({ id: draftPicks.id, playerId: draftPicks.playerId })
    .from(draftPicks)
    .where(and(baseWhere, isNotNull(draftPicks.playerId)));

  for (const p of made) {
    if (p.playerId) {
      await db.update(players)
        .set({ teamId: sql`NULL`, touch_id: clearedBy })
        .where(eq(players.id, p.playerId));
    }
  }

  // Reset selections only — keep the pick slot structure intact
  await db.update(draftPicks)
    .set({ playerId: null, selectedPlayerName: null, pickedAt: null, passed: false, warningSent: false, touch_id: clearedBy })
    .where(baseWhere);
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

/**
 * Check if any picks exist for a given league/year/draftType
 */
export async function getDraftPicksExist(leagueId: number, year: number, draftType: string): Promise<boolean> {
  const row = await db.select({ id: draftPicks.id })
    .from(draftPicks)
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, year), eq(draftPicks.draftType, draftType)))
    .limit(1);
  return row.length > 0;
}

/**
 * Check if the draft has started (any pick has been made or passed)
 */
export async function hasDraftStarted(leagueId: number, year: number, draftType: string): Promise<boolean> {
  const row = await db.select({ id: draftPicks.id })
    .from(draftPicks)
    .where(and(
      eq(draftPicks.leagueId, leagueId),
      eq(draftPicks.year, year),
      eq(draftPicks.draftType, draftType),
      or(isNotNull(draftPicks.pickedAt), eq(draftPicks.passed, true)),
    ))
    .limit(1);
  return row.length > 0;
}

/**
 * Delete ALL pick rows (not just selections) for a league/year/draftType
 */
export async function deleteDraftPicksByYearAndType(leagueId: number, year: number, draftType: string, deletedBy: string): Promise<void> {
  // First free up any rostered players
  const made = await db.select({ playerId: draftPicks.playerId })
    .from(draftPicks)
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, year), eq(draftPicks.draftType, draftType), isNotNull(draftPicks.playerId)));

  for (const p of made) {
    if (p.playerId) {
      await db.update(players).set({ teamId: sql`NULL`, touch_id: deletedBy }).where(eq(players.id, p.playerId));
    }
  }

  await db.delete(draftPicks).where(and(
    eq(draftPicks.leagueId, leagueId),
    eq(draftPicks.year, year),
    eq(draftPicks.draftType, draftType),
  ));
}

export type DraftOrderEntry = {
  teamId: number;
  teamshort: string;
  r1Position: number; // 0-based index in round 1 order
  altGroup?: string;  // e.g. "A", "B", "C" — teams in the same group rotate
};

/**
 * Generate draft pick rows using the alt-group rotation algorithm.
 * Returns insert-ready objects (no DB writes — caller decides).
 */
export function generateDraftPickRows(params: {
  leagueId: number;
  year: number;
  draftType: string;
  rounds: number;
  order: DraftOrderEntry[];
  touchId: string;
  startAt?: Date;
  hoursPerPick?: number;
}): Array<typeof draftPicks.$inferInsert> {
  const { leagueId, year, draftType, rounds, order, touchId, startAt, hoursPerPick } = params;

  // Build alt group index: groupId → sorted array of entries (sorted by r1Position)
  const altGroups: Record<string, DraftOrderEntry[]> = {};
  for (const entry of order) {
    if (entry.altGroup) {
      if (!altGroups[entry.altGroup]) altGroups[entry.altGroup] = [];
      altGroups[entry.altGroup].push(entry);
    }
  }
  // Sort each group by r1Position so idxInGroup is deterministic
  for (const g of Object.values(altGroups)) {
    g.sort((a, b) => a.r1Position - b.r1Position);
  }

  const getWeight = (entry: DraftOrderEntry, round: number): number => {
    if (!entry.altGroup) return entry.r1Position;
    const group = altGroups[entry.altGroup];
    const idxInGroup = group.findIndex(e => e.teamId === entry.teamId);
    const rotatedIdx = (idxInGroup + (round - 1)) % group.length;
    return group[rotatedIdx].r1Position;
  };

  const rows: Array<typeof draftPicks.$inferInsert> = [];
  let overall = 1;

  for (let round = 1; round <= rounds; round++) {
    // Sort the order for this round by effective weight
    const sorted = [...order].sort((a, b) => getWeight(a, round) - getWeight(b, round));
    for (const entry of sorted) {
      const scheduledAt = (startAt && hoursPerPick)
        ? new Date(startAt.getTime() + (overall - 1) * hoursPerPick * 3600000)
        : undefined;
      rows.push({
        leagueId,
        year,
        round,
        pick: overall,
        draftType,
        originalTeamId: entry.teamId,
        currentTeamId: entry.teamId,
        scheduledAt,
        touch_id: touchId,
      });
      overall++;
    }
  }

  return rows;
}

/**
 * Record or update the current owner of a traded pick in pickTransfers.
 * Looks up stable pick identity (year, round, draftType, originalTeamId) from draftPicks.
 * If the pick cannot be found in draftPicks, logs a warning and returns early.
 */
export async function upsertPickTransfer(params: {
  leagueId: number;
  pickOverall: number;
  toTeamId: number;
  touchId: string;
}): Promise<void> {
  const { leagueId, pickOverall, toTeamId, touchId } = params;

  const existing = await db.select({
    year: draftPicks.year,
    round: draftPicks.round,
    draftType: draftPicks.draftType,
    originalTeamId: draftPicks.originalTeamId,
  })
    .from(draftPicks)
    .where(and(eq(draftPicks.pick, pickOverall), eq(draftPicks.leagueId, leagueId)))
    .limit(1);

  if (!existing[0]) {
    console.warn(`[upsertPickTransfer] Pick overall=${pickOverall} not found in draftPicks for leagueId=${leagueId} — transfer not recorded`);
    return;
  }

  const { year, round, draftType, originalTeamId } = existing[0];

  if (!originalTeamId) {
    console.warn(`[upsertPickTransfer] Pick overall=${pickOverall} has no originalTeamId — transfer not recorded`);
    return;
  }

  await db.insert(pickTransfers)
    .values({ leagueId, year, draftType, round, originalTeamId, currentTeamId: toTeamId, touch_id: touchId })
    .onConflictDoUpdate({
      target: [pickTransfers.leagueId, pickTransfers.year, pickTransfers.draftType, pickTransfers.round, pickTransfers.originalTeamId],
      set: { currentTeamId: toTeamId, touch_id: touchId, touch_dt: sql`now()` },
    });
}

/**
 * Re-apply all recorded pick transfers for a given league/year/draftType.
 * Called after draft picks are regenerated so traded pick ownership is restored.
 * Returns the count of picks successfully updated.
 */
export async function applyPickTransfers(leagueId: number, year: number, draftType: string): Promise<number> {
  const transfers = await db.select()
    .from(pickTransfers)
    .where(and(
      eq(pickTransfers.leagueId, leagueId),
      eq(pickTransfers.year, year),
      eq(pickTransfers.draftType, draftType),
    ));

  let count = 0;
  for (const transfer of transfers) {
    if (!transfer.originalTeamId || !transfer.currentTeamId) continue;
    const result = await db.update(draftPicks)
      .set({ currentTeamId: transfer.currentTeamId })
      .where(and(
        eq(draftPicks.leagueId, leagueId),
        eq(draftPicks.year, year),
        eq(draftPicks.draftType, draftType),
        eq(draftPicks.round, transfer.round),
        eq(draftPicks.originalTeamId, transfer.originalTeamId),
      ));
    if ((result as unknown as { rowCount?: number }).rowCount) count++;
  }

  return count;
}

export type PickTransferRow = {
  year: number;
  draftType: string;
  round: number;
  originalTeam: string;
  originalTeamName: string;
  currentTeam: string;
  currentTeamName: string;
  isDrafted: boolean;
  draftedPlayer: string | null;
};

/**
 * Get all traded picks (where original owner ≠ current owner) for a league.
 */
export async function getPickTransferHistory(leagueId: number = 1): Promise<PickTransferRow[]> {
  const originalTeams = alias(teams, 'originalTeams');
  const currentTeams = alias(teams, 'currentTeams');

  const rows = await db.select({
    year: pickTransfers.year,
    draftType: pickTransfers.draftType,
    round: pickTransfers.round,
    originalTeam: originalTeams.teamshort,
    originalTeamName: originalTeams.name,
    currentTeam: currentTeams.teamshort,
    currentTeamName: currentTeams.name,
    draftedPlayer: players.name,
    selectedPlayerName: draftPicks.selectedPlayerName,
  })
    .from(pickTransfers)
    .innerJoin(originalTeams, eq(pickTransfers.originalTeamId, originalTeams.id))
    .innerJoin(currentTeams, eq(pickTransfers.currentTeamId, currentTeams.id))
    .leftJoin(draftPicks, and(
      eq(draftPicks.leagueId, pickTransfers.leagueId),
      eq(draftPicks.year, pickTransfers.year),
      eq(draftPicks.draftType, pickTransfers.draftType),
      eq(draftPicks.round, pickTransfers.round),
      eq(draftPicks.originalTeamId, pickTransfers.originalTeamId),
    ))
    .leftJoin(players, eq(draftPicks.playerId, players.id))
    .where(eq(pickTransfers.leagueId, leagueId))
    .orderBy(asc(pickTransfers.year), asc(pickTransfers.draftType), asc(pickTransfers.round));

  return rows.map(r => ({
    year: r.year,
    draftType: r.draftType,
    round: r.round,
    originalTeam: r.originalTeam ?? '',
    originalTeamName: r.originalTeamName ?? '',
    currentTeam: r.currentTeam ?? '',
    currentTeamName: r.currentTeamName ?? '',
    isDrafted: !!(r.draftedPlayer || r.selectedPlayerName),
    draftedPlayer: r.draftedPlayer || r.selectedPlayerName || null,
  }));
}