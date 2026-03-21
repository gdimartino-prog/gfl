/**
 * Apply draft pick trades for 2026 free_agent draft.
 * Each entry maps round N → originalTeam's pick goes to newOwner.
 * Run: POSTGRES_URL="..." npx tsx scripts/apply-pick-transfers.ts
 */
import { db } from '../lib/db';
import { draftPicks, pickTransfers } from '../schema';
import { and, eq, sql } from 'drizzle-orm';

// Round-by-round trades: [round, fromShort, toShort]
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
  // Build teamshort → id map (prefer active teams; for TFT pick the one with picks)
  const teamRows = await db.execute(sql`
    SELECT DISTINCT t.teamshort, t.id
    FROM teams t
    JOIN draft_picks dp ON dp.original_team_id = t.id
    WHERE dp.league_id = ${LEAGUE_ID} AND dp.year = ${YEAR} AND dp.draft_type = ${DRAFT_TYPE}
  `);
  const teamMap = new Map<string, number>();
  (teamRows as any).rows.forEach((r: any) => teamMap.set(r.teamshort, r.id));
  console.log('Team map:', Object.fromEntries(teamMap));

  let applied = 0, skipped = 0;

  for (const [round, fromShort, toShort] of trades) {
    const fromId = teamMap.get(fromShort);
    const toId = teamMap.get(toShort);
    if (!fromId) { console.warn(`  SKIP R${round}: unknown team "${fromShort}"`); skipped++; continue; }
    if (!toId) { console.warn(`  SKIP R${round}: unknown team "${toShort}"`); skipped++; continue; }

    // Find the pick
    const pick = await db.select({
      id: draftPicks.id,
      originalTeamId: draftPicks.originalTeamId,
      currentTeamId: draftPicks.currentTeamId,
    })
      .from(draftPicks)
      .where(and(
        eq(draftPicks.leagueId, LEAGUE_ID),
        eq(draftPicks.year, YEAR),
        eq(draftPicks.draftType, DRAFT_TYPE),
        eq(draftPicks.round, round),
        eq(draftPicks.originalTeamId, fromId),
      ))
      .limit(1);

    if (!pick[0]) {
      console.warn(`  SKIP R${round}: no pick found for original=${fromShort}(${fromId})`);
      skipped++;
      continue;
    }

    // Update draft_picks
    await db.update(draftPicks)
      .set({ currentTeamId: toId, touch_id: TOUCH_ID })
      .where(eq(draftPicks.id, pick[0].id));

    // Upsert draft_pick_transfers
    await db.insert(pickTransfers)
      .values({ leagueId: LEAGUE_ID, year: YEAR, draftType: DRAFT_TYPE, round, originalTeamId: fromId, currentTeamId: toId, touch_id: TOUCH_ID })
      .onConflictDoUpdate({
        target: [pickTransfers.leagueId, pickTransfers.year, pickTransfers.draftType, pickTransfers.round, pickTransfers.originalTeamId],
        set: { currentTeamId: toId, touch_id: TOUCH_ID, touch_dt: sql`now()` },
      });

    console.log(`  ✓ R${round}: ${fromShort} → ${toShort}`);
    applied++;
  }

  console.log(`\nDone: ${applied} applied, ${skipped} skipped.`);
}
main().catch(console.error).finally(() => process.exit(0));
