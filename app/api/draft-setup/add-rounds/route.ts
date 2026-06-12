import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { draftPicks, teams } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { isAdmin } from '@/lib/auth';
import { auth } from '@/auth';
import { revalidateTag } from 'next/cache';
import type { DraftOrderEntry } from '@/lib/draftPicks';
import { applyPickTransfers } from '@/lib/draftPicks';
import { logSystemEvent } from '@/lib/db-helpers';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !await isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const actor = (session.user as { name?: string }).name ?? 'commissioner';

  const body = await req.json();
  const { year, draftType, additionalRounds } = body;

  if (!year || typeof year !== 'number' || year < 2020 || year > 2100) {
    return Response.json({ error: 'Invalid year' }, { status: 400 });
  }
  if (!['free_agent', 'rookie'].includes(draftType)) {
    return Response.json({ error: 'Invalid draftType' }, { status: 400 });
  }
  if (!additionalRounds || typeof additionalRounds !== 'number' || additionalRounds < 1 || additionalRounds > 20) {
    return Response.json({ error: 'additionalRounds must be between 1 and 20' }, { status: 400 });
  }

  const leagueId = await getLeagueId();

  const existingPicks = await db
    .select({
      round: draftPicks.round,
      pick: draftPicks.pick,
      originalTeamId: draftPicks.originalTeamId,
      teamshort: teams.teamshort,
    })
    .from(draftPicks)
    .leftJoin(teams, eq(draftPicks.originalTeamId, teams.id))
    .where(and(
      eq(draftPicks.leagueId, leagueId),
      eq(draftPicks.year, year),
      eq(draftPicks.draftType, draftType),
    ))
    .orderBy(draftPicks.round, draftPicks.pick);

  if (existingPicks.length === 0) {
    return Response.json({ error: `No existing picks found for ${year} ${draftType === 'free_agent' ? 'Free Agent' : 'Rookie'} draft` }, { status: 404 });
  }

  const round1Picks = existingPicks.filter(p => p.round === 1).sort((a, b) => a.pick - b.pick);
  const numTeams = round1Picks.length;

  if (numTeams === 0) {
    return Response.json({ error: 'Could not determine team order (no round 1 picks found)' }, { status: 400 });
  }

  const r1OrderByPos = round1Picks.map(p => p.originalTeamId!);
  const teamshortById = new Map(round1Picks.map(p => [p.originalTeamId!, p.teamshort ?? '']));

  // Detect alt-groups by comparing round 1 and round 2 pick positions.
  // Teams that rotate between rounds are traced as a permutation cycle.
  const round2Picks = existingPicks.filter(p => p.round === 2).sort((a, b) => a.pick - b.pick);
  const altGroupByTeam = new Map<number, string>();

  if (round2Picks.length === numTeams) {
    const r2OrderByPos = round2Picks.map(p => p.originalTeamId!);
    const r2PosOfTeam = new Map<number, number>(round2Picks.map((p, i) => [p.originalTeamId!, i]));

    const movedTeams = new Set<number>();
    for (let i = 0; i < numTeams; i++) {
      if (r1OrderByPos[i] !== r2OrderByPos[i]) movedTeams.add(r1OrderByPos[i]);
    }

    const visited = new Set<number>();
    const groups: number[][] = [];

    for (const startTeam of movedTeams) {
      if (visited.has(startTeam)) continue;
      const cycle: number[] = [];
      let current = startTeam;
      while (!visited.has(current)) {
        visited.add(current);
        cycle.push(current);
        const r2Pos = r2PosOfTeam.get(current) ?? -1;
        if (r2Pos < 0) break;
        const next = r1OrderByPos[r2Pos];
        if (next === undefined) break;
        current = next;
      }
      if (cycle.length > 1) groups.push(cycle);
    }

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    groups.forEach((group, idx) => {
      const letter = letters[idx] ?? String.fromCharCode(73 + idx);
      for (const teamId of group) altGroupByTeam.set(teamId, letter);
    });
  }

  const order: DraftOrderEntry[] = round1Picks.map((p, i) => ({
    teamId: p.originalTeamId!,
    teamshort: teamshortById.get(p.originalTeamId!) ?? '',
    r1Position: i,
    altGroup: altGroupByTeam.get(p.originalTeamId!) ?? undefined,
  }));

  const maxRound = existingPicks.reduce((m, p) => Math.max(m, p.round), 0);
  const maxPick = existingPicks.reduce((m, p) => Math.max(m, p.pick), 0);

  const fromRound = maxRound + 1;
  const toRound = maxRound + additionalRounds;

  // Build alt-group index for the weight function (same as generateDraftPickRows)
  const altGroups: Record<string, DraftOrderEntry[]> = {};
  for (const entry of order) {
    if (entry.altGroup) {
      if (!altGroups[entry.altGroup]) altGroups[entry.altGroup] = [];
      altGroups[entry.altGroup].push(entry);
    }
  }
  for (const g of Object.values(altGroups)) g.sort((a, b) => a.r1Position - b.r1Position);

  const getWeight = (entry: DraftOrderEntry, round: number): number => {
    if (!entry.altGroup) return entry.r1Position;
    const group = altGroups[entry.altGroup];
    const idxInGroup = group.findIndex(e => e.teamId === entry.teamId);
    const rotatedIdx = (idxInGroup + (round - 1)) % group.length;
    return group[rotatedIdx].r1Position;
  };

  const newRows: Array<typeof draftPicks.$inferInsert> = [];
  let overall = maxPick + 1;

  for (let round = fromRound; round <= toRound; round++) {
    const sorted = [...order].sort((a, b) => getWeight(a, round) - getWeight(b, round));
    for (const entry of sorted) {
      newRows.push({
        leagueId,
        year,
        round,
        pick: overall++,
        draftType,
        originalTeamId: entry.teamId,
        currentTeamId: entry.teamId,
        touch_id: actor,
      });
    }
  }

  await db.insert(draftPicks).values(newRows);
  await applyPickTransfers(leagueId, year, draftType);
  await revalidateTag('draft-picks', 'max');
  await logSystemEvent(actor, 'admin', 'DRAFT_ROUNDS_ADDED', `Added rounds ${fromRound}–${toRound} to ${year} ${draftType}`, leagueId);

  return Response.json({ inserted: newRows.length, fromRound, toRound });
}
