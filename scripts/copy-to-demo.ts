/**
 * Copy GFL (leagueId=1) transaction history and draft picks to Demo league (leagueId=2).
 * Safe to re-run — clears demo data first.
 *
 * RUN:
 *   node --env-file=.env.local --import tsx scripts/copy-to-demo.ts
 */

import { db } from '../lib/db';
import { teams, transactions, draftPicks, resources } from '../schema';
import { eq } from 'drizzle-orm';

const PHOTOS_BLOB_URL = 'https://vlywku3xqdrolqhy.public.blob.vercel-storage.com/Player-Photos-2026.zip';

const GFL = 1;
const DEMO = 2;

// ── 1. Build teamId mapping (GFL id → demo id) by teamshort ──────────────────
const gflTeams  = await db.select({ id: teams.id, ts: teams.teamshort }).from(teams).where(eq(teams.leagueId, GFL));
const demoTeams = await db.select({ id: teams.id, ts: teams.teamshort }).from(teams).where(eq(teams.leagueId, DEMO));

const demoByShort = new Map(demoTeams.filter(t => t.ts).map(t => [t.ts!.toLowerCase(), t.id]));
const teamMap = new Map<number, number>();
for (const t of gflTeams) {
  if (!t.ts) continue;
  const demoId = demoByShort.get(t.ts.toLowerCase());
  if (demoId) teamMap.set(t.id, demoId);
}
console.log(`Team mapping: ${teamMap.size} GFL teams → demo equivalents`);

// ── 2. Clear existing demo data ───────────────────────────────────────────────
const deletedPicks = await db.delete(draftPicks).where(eq(draftPicks.leagueId, DEMO));
const deletedTx    = await db.delete(transactions).where(eq(transactions.leagueId, DEMO));
console.log(`Cleared demo: ${(deletedPicks as unknown as { rowCount?: number }).rowCount ?? '?'} picks, ${(deletedTx as unknown as { rowCount?: number }).rowCount ?? '?'} transactions`);

// ── 3. Copy transactions ──────────────────────────────────────────────────────
const gflTx = await db.select().from(transactions).where(eq(transactions.leagueId, GFL));

if (gflTx.length) {
  const txRows = gflTx.map(({ id: _id, leagueId: _l, pickIds: _p, ...rest }) => ({
    ...rest,
    leagueId: DEMO,
    pickIds: null,   // GFL pick IDs are stale in demo context
  }));
  await db.insert(transactions).values(txRows);
  console.log(`Copied ${txRows.length} transactions`);
}

// ── 4. Copy draft picks ───────────────────────────────────────────────────────
const gflPicks = await db.select().from(draftPicks).where(eq(draftPicks.leagueId, GFL));

let skipped = 0;
const pickRows = [];
for (const { id: _id, leagueId: _l, originalTeamId, currentTeamId, playerId: _p, ...rest } of gflPicks) {
  const origDemo    = originalTeamId ? teamMap.get(originalTeamId) : null;
  const currentDemo = currentTeamId  ? teamMap.get(currentTeamId)  : null;

  // Skip if either team has no demo equivalent
  if (!origDemo || !currentDemo) { skipped++; continue; }

  pickRows.push({
    ...rest,
    leagueId: DEMO,
    originalTeamId: origDemo,
    currentTeamId:  currentDemo,
    playerId: null,   // keep selectedPlayerName snapshot; demo player IDs differ
  });
}

if (pickRows.length) {
  // Insert in batches to avoid parameter limits
  const BATCH = 200;
  for (let i = 0; i < pickRows.length; i += BATCH) {
    await db.insert(draftPicks).values(pickRows.slice(i, i + BATCH));
  }
}

console.log(`Copied ${pickRows.length} draft picks (skipped ${skipped} — teams not in demo league)`);
// ── 5. Copy league resources ──────────────────────────────────────────────────
const gflResources = await db.select().from(resources).where(eq(resources.leagueId, GFL));

if (gflResources.length) {
  await db.delete(resources).where(eq(resources.leagueId, DEMO));
  const resourceRows = gflResources.map(({ id: _id, leagueId: _l, url, ...rest }) => ({
    ...rest,
    leagueId: DEMO,
    // Point Player Photos to the Vercel Blob ZIP instead of the old Google Drive link
    url: rest.title === 'Player Photos' ? PHOTOS_BLOB_URL : url,
  }));
  await db.insert(resources).values(resourceRows);
  console.log(`Copied ${resourceRows.length} resources`);
}

console.log('Done.');
process.exit(0);
