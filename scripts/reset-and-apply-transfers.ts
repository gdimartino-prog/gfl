/**
 * Reset all pick ownership for 2026 free_agent draft back to original,
 * clear draft_pick_transfers, then apply only the provided 20 trades.
 */
import { db } from '../lib/db';
import { draftPicks, pickTransfers } from '../schema';
import { and, eq, sql } from 'drizzle-orm';

const trades: [number, string, string][] = [
  [1,  'UF',  'LES'],
  [2,  'TFT', 'LM'],
  [3,  'LBI', 'CK'],
  [4,  'FPR', 'SG'],
  [5,  'CT',  'AFL'],
  [6,  'UF',  'LES'],
  [7,  'TT',  'CK'],
  [8,  'TFT', 'OBG'],
  [9,  'FPR', 'SG'],
  [10, 'SG',  'OBG'],
  [11, 'UF',  'OBG'],
  [12, 'AFL', 'CK'],
  [13, 'FPR', 'CK'],
  [14, 'OBG', 'AFL'],
  [15, 'CK',  'AFL'],
  [16, 'CT',  'OBG'],
  [17, 'DC',  'AFL'],
  [18, 'FPR', 'SG'],
  [19, 'CK',  'LBI'],
  [20, 'CT',  'AFL'],
];

const LEAGUE_ID = 1;
const YEAR = 2026;
const DRAFT_TYPE = 'free_agent';
const TOUCH_ID = 'trade-migration';

async function main() {
  // Step 1: Reset all picks to original owner
  await db.execute(sql`
    UPDATE draft_picks
    SET current_team_id = original_team_id, touch_id = ${TOUCH_ID}
    WHERE league_id = ${LEAGUE_ID} AND year = ${YEAR} AND draft_type = ${DRAFT_TYPE}
  `);
  console.log('✓ Reset all picks to original owner');

  // Step 2: Clear all transfers for this draft
  await db.delete(pickTransfers).where(and(
    eq(pickTransfers.leagueId, LEAGUE_ID),
    eq(pickTransfers.year, YEAR),
    eq(pickTransfers.draftType, DRAFT_TYPE),
  ));
  console.log('✓ Cleared draft_pick_transfers');

  // Step 3: Build team map from picks (only teams that have picks)
  const teamRows = await db.execute(sql`
    SELECT DISTINCT t.teamshort, t.id
    FROM teams t
    JOIN draft_picks dp ON dp.original_team_id = t.id
    WHERE dp.league_id = ${LEAGUE_ID} AND dp.year = ${YEAR} AND dp.draft_type = ${DRAFT_TYPE}
  `);
  const teamMap = new Map<string, number>();
  (teamRows as any).rows.forEach((r: any) => teamMap.set(r.teamshort, r.id));

  // Step 4: Apply the 20 trades
  let applied = 0;
  for (const [round, fromShort, toShort] of trades) {
    const fromId = teamMap.get(fromShort);
    const toId = teamMap.get(toShort);
    if (!fromId || !toId) { console.warn(`  SKIP R${round}: unknown team "${fromShort}" or "${toShort}"`); continue; }

    const pick = await db.select({ id: draftPicks.id, originalTeamId: draftPicks.originalTeamId })
      .from(draftPicks)
      .where(and(
        eq(draftPicks.leagueId, LEAGUE_ID),
        eq(draftPicks.year, YEAR),
        eq(draftPicks.draftType, DRAFT_TYPE),
        eq(draftPicks.round, round),
        eq(draftPicks.originalTeamId, fromId),
      ))
      .limit(1);

    if (!pick[0]) { console.warn(`  SKIP R${round}: no pick for ${fromShort}`); continue; }

    await db.update(draftPicks)
      .set({ currentTeamId: toId, touch_id: TOUCH_ID })
      .where(eq(draftPicks.id, pick[0].id));

    await db.insert(pickTransfers).values({
      leagueId: LEAGUE_ID, year: YEAR, draftType: DRAFT_TYPE,
      round, originalTeamId: fromId, currentTeamId: toId, touch_id: TOUCH_ID,
    });

    console.log(`  ✓ R${round}: ${fromShort} → ${toShort}`);
    applied++;
  }

  console.log(`\nDone: ${applied} trades applied.`);
}
main().catch(console.error).finally(() => process.exit(0));
