/**
 * Consolidate same-identity duplicate player rows.
 *
 * For each (leagueId, identity) group with >1 row:
 *   - Keep the canonical row (drafted > team-affiliated > lowest id)
 *   - Delete the orphans (unless they're referenced by a draft pick)
 *
 * Usage (dry run):
 *   node --env-file=.env.local --import tsx scripts/dedupe-players.ts
 * Apply:
 *   node --env-file=.env.local --import tsx scripts/dedupe-players.ts --apply
 */
import { db } from '../lib/db';
import { players, draftPicks } from '../schema';
import { isNotNull, inArray, and } from 'drizzle-orm';

const apply = process.argv.includes('--apply');

const allPlayers = await db
  .select({ id: players.id, leagueId: players.leagueId, name: players.name, identity: players.identity, teamId: players.teamId })
  .from(players);

const drafted = await db
  .select({ playerId: draftPicks.playerId })
  .from(draftPicks)
  .where(and(isNotNull(draftPicks.playerId)));
const draftedIds = new Set(drafted.map(r => r.playerId!));

const groups = new Map<string, typeof allPlayers>();
for (const p of allPlayers) {
  if (!p.identity) continue;
  const key = `${p.leagueId}::${p.identity}`;
  const arr = groups.get(key) ?? [];
  arr.push(p);
  groups.set(key, arr);
}

const orphanIds: number[] = [];
let groupCount = 0;
for (const [key, group] of groups) {
  if (group.length === 1) continue;
  groupCount++;
  const ranked = [...group].sort((a, b) => {
    const aD = draftedIds.has(a.id) ? 1 : 0;
    const bD = draftedIds.has(b.id) ? 1 : 0;
    if (aD !== bD) return bD - aD;
    const aT = a.teamId !== null ? 1 : 0;
    const bT = b.teamId !== null ? 1 : 0;
    if (aT !== bT) return bT - aT;
    return a.id - b.id;
  });
  const [canonical, ...dupes] = ranked;
  console.log(`\n[${key}]`);
  console.log(`  KEEP id=${canonical.id} name="${canonical.name}" teamId=${canonical.teamId} drafted=${draftedIds.has(canonical.id)}`);
  for (const d of dupes) {
    const isDrafted = draftedIds.has(d.id);
    console.log(`  ${isDrafted ? 'SKIP (drafted)' : 'DELETE'} id=${d.id} name="${d.name}" teamId=${d.teamId}`);
    if (!isDrafted) orphanIds.push(d.id);
  }
}

console.log(`\nFound ${groupCount} duplicate identity groups across ${allPlayers.length} player rows.`);
console.log(`Would delete ${orphanIds.length} orphan rows.`);

if (apply && orphanIds.length > 0) {
  await db.delete(players).where(inArray(players.id, orphanIds));
  console.log(`\nDeleted ${orphanIds.length} rows.`);
} else if (!apply) {
  console.log(`\nDry run — re-run with --apply to commit.`);
}
process.exit(0);
