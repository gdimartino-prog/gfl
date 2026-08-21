import 'dotenv/config';
import { db } from '../lib/db';
import { draftPicks, pickTransfers, teams, players } from '../schema';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const originalTeams = alias(teams, 'originalTeams');
const currentTeams = alias(teams, 'currentTeams');

const rows = await db.select({
  id: draftPicks.id,
  pick: draftPicks.pick,
  round: draftPicks.round,
  draftType: draftPicks.draftType,
  originalTeam: originalTeams.name,
  originalTeamShort: originalTeams.teamshort,
  currentOwner: currentTeams.teamshort,
  selectedPlayer: players.name,
  selectedPlayerName: draftPicks.selectedPlayerName,
  pickedAt: draftPicks.pickedAt,
  passed: draftPicks.passed,
  transferHistory: pickTransfers.history,
})
.from(draftPicks)
.leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
.leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
.leftJoin(players, eq(draftPicks.playerId, players.id))
.leftJoin(pickTransfers, and(
  eq(pickTransfers.leagueId, draftPicks.leagueId),
  eq(pickTransfers.year, draftPicks.year),
  eq(pickTransfers.draftType, draftPicks.draftType),
  eq(pickTransfers.round, draftPicks.round),
  eq(pickTransfers.originalTeamId, draftPicks.originalTeamId),
))
.where(eq(draftPicks.leagueId, 1));

const filtered = rows.filter(p => p.draftType === 'free_agent');
const sorted = [...filtered].sort((a, b) => (a.pick ?? 0) - (b.pick ?? 0));

// Check for duplicates in the returned rows
const pickCounts = new Map<number, number>();
for (const p of sorted) pickCounts.set(p.pick ?? -1, (pickCounts.get(p.pick ?? -1) ?? 0) + 1);
const dupes = [...pickCounts.entries()].filter(([, count]) => count > 1);
console.log('Duplicate pick numbers in query result:', dupes.length > 0 ? dupes : 'none');

// Show first 15 picks
console.log('\n=== First 15 picks (sorted) ===');
console.log('id\tpick\trnd\tcurrOwner\tselectedPlayer\tselectedPlayerName\tpickedAt');
for (const p of sorted.slice(0, 15)) {
  console.log(`${p.id}\t${p.pick}\t${p.round}\t${p.currentOwner}\t${p.selectedPlayer ?? ''}\t${p.selectedPlayerName ?? ''}\t${p.pickedAt ?? ''}`);
}

// Simulate Active pick logic
const draftedPickNums = new Set<number>(
  sorted.filter(p => !!p.selectedPlayer || !!p.selectedPlayerName).map(p => p.pick ?? -1)
);
console.log('\ndraftedPickNums:', [...draftedPickNums]);

for (const p of sorted) {
  const isSkipped = !p.selectedPlayer && !p.selectedPlayerName && !!p.pickedAt && !p.passed;
  const isDrafted = !!p.selectedPlayer || !!p.selectedPlayerName || isSkipped;
  if (!isDrafted && !p.passed && !draftedPickNums.has(p.pick ?? -1)) {
    console.log(`\n=> Active pick: id=${p.id} pick=${p.pick} round=${p.round} currentOwner=${p.currentOwner}`);
    break;
  }
}
