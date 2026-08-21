import 'dotenv/config';
import { db } from '../lib/db';
import { draftPicks, pickTransfers, teams } from '../schema';
import { and, eq, sql } from 'drizzle-orm';

const LEAGUE_ID = 1;

const lbiRow = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.teamshort, 'LBI'), eq(teams.leagueId, LEAGUE_ID))).limit(1);
const tcRow  = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.teamshort, 'TC'),  eq(teams.leagueId, LEAGUE_ID))).limit(1);
const ckRow  = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.teamshort, 'CK'),  eq(teams.leagueId, LEAGUE_ID))).limit(1);

const lbiId = lbiRow[0].id, tcId = tcRow[0].id, ckId = ckRow[0].id;

// Step 1: Revert the wrong 2027 TC→CK transfer (pick id=2793)
await db.update(draftPicks)
  .set({ currentTeamId: tcId })
  .where(and(eq(draftPicks.id, 2793), eq(draftPicks.leagueId, LEAGUE_ID)));

await db.delete(pickTransfers)
  .where(and(
    eq(pickTransfers.leagueId, LEAGUE_ID),
    eq(pickTransfers.year, 2027),
    eq(pickTransfers.round, 1),
    eq(pickTransfers.draftType, 'free_agent'),
    eq(pickTransfers.originalTeamId, tcId),
  ));

console.log('✓ Reverted wrong 2027 TC→CK transfer');

// Step 2: Add correct 2026 LBI→CK transfer (pick id=2344, overall #16)
await db.insert(pickTransfers)
  .values({
    leagueId: LEAGUE_ID,
    year: 2026,
    draftType: 'free_agent',
    round: 1,
    originalTeamId: lbiId,
    currentTeamId: ckId,
    touch_id: 'fix-script',
  })
  .onConflictDoUpdate({
    target: [pickTransfers.leagueId, pickTransfers.year, pickTransfers.draftType, pickTransfers.round, pickTransfers.originalTeamId],
    set: { currentTeamId: ckId, touch_id: 'fix-script', touch_dt: sql`now()` },
  });

await db.update(draftPicks)
  .set({ currentTeamId: ckId })
  .where(and(eq(draftPicks.id, 2344), eq(draftPicks.leagueId, LEAGUE_ID)));

console.log('✓ Added correct 2026 LBI→CK transfer (overall #16)');
console.log('\nDone.');
process.exit(0);
