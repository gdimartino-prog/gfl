import 'dotenv/config';
import { db } from '../lib/db';
import { draftPicks, pickTransfers, teams } from '../schema';
import { and, eq, sql } from 'drizzle-orm';

const LEAGUE_ID = 1;

const get = async (short: string) => {
  const r = await db.select({ id: teams.id, name: teams.name }).from(teams)
    .where(and(eq(teams.teamshort, short), eq(teams.leagueId, LEAGUE_ID))).limit(1);
  if (!r[0]) throw new Error(`Team not found: ${short}`);
  return r[0];
};

const lbi = await get('LBI');
const ct  = await get('CT');
const obg = await get('OBG');
const ck  = await get('CK');

console.log('LBI:', lbi.id, lbi.name);
console.log('CT:', ct.id, ct.name);
console.log('OBG:', obg.id, obg.name);
console.log('CK:', ck.id, ck.name);

// Show current state of 2026 Rd1 transfers involving these teams
const current = await db.execute(sql`
  SELECT pt.id, pt.original_team_id, pt.current_team_id, pt.history,
         ot.teamshort as orig_short, ct2.teamshort as curr_short
  FROM draft_pick_transfers pt
  JOIN teams ot ON ot.id = pt.original_team_id
  JOIN teams ct2 ON ct2.id = pt.current_team_id
  WHERE pt.league_id = ${LEAGUE_ID} AND pt.year = 2026 AND pt.round = 1
  ORDER BY pt.id
`);
console.log('\nCurrent 2026 Rd1 transfers:');
console.log(JSON.stringify(current.rows, null, 2));

// 1. Delete the CK→OBG entry (Crimson's own Rd1 pick going to OBG — this is wrong)
await db.delete(pickTransfers)
  .where(and(
    eq(pickTransfers.leagueId, LEAGUE_ID),
    eq(pickTransfers.year, 2026),
    eq(pickTransfers.round, 1),
    eq(pickTransfers.draftType, 'free_agent'),
    eq(pickTransfers.originalTeamId, ck.id),
  ));
console.log('\n✓ Deleted erroneous CK→OBG Rd1 transfer');

// Also reset CK's own Rd1 draft_pick back to CK
await db.update(draftPicks)
  .set({ currentTeamId: ck.id })
  .where(and(
    eq(draftPicks.leagueId, LEAGUE_ID),
    eq(draftPicks.year, 2026),
    eq(draftPicks.round, 1),
    eq(draftPicks.draftType, 'free_agent'),
    eq(draftPicks.originalTeamId, ck.id),
  ));
console.log('✓ Reset CK Rd1 draft_pick back to CK');

// 2. Update LBI→CK to LBI→OBG with CK in history
await db.update(pickTransfers)
  .set({ currentTeamId: obg.id, history: [ck.id] })
  .where(and(
    eq(pickTransfers.leagueId, LEAGUE_ID),
    eq(pickTransfers.year, 2026),
    eq(pickTransfers.round, 1),
    eq(pickTransfers.draftType, 'free_agent'),
    eq(pickTransfers.originalTeamId, lbi.id),
  ));
console.log('✓ Updated LBI Rd1 transfer: LBI → CK → OBG');

// Update the draft_picks row for LBI's Rd1 pick to OBG
await db.update(draftPicks)
  .set({ currentTeamId: obg.id })
  .where(and(
    eq(draftPicks.leagueId, LEAGUE_ID),
    eq(draftPicks.year, 2026),
    eq(draftPicks.round, 1),
    eq(draftPicks.draftType, 'free_agent'),
    eq(draftPicks.originalTeamId, lbi.id),
  ));
console.log('✓ Updated LBI Rd1 draft_pick current owner → OBG');

console.log('\nDone. Chain: LBI → CK → OBG');
process.exit(0);
