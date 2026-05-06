/**
 * Fix Fur Peace standings aggregation on the Franchise Leaderboard.
 *
 * Root cause: standings rows for teamId=45 (GFL Fur Peace, leagueId=1) for years
 * 2004–2020 have oldTeamName="Tinton Falls". getHistory() uses
 * `team: r.oldTeamName || r.teamName` so those rows are attributed to "Tinton Falls"
 * instead of "Fur Peace", splitting the franchise's championship history.
 *
 * Because the team.name is already "Fur Peace", clearing oldTeamName on those rows
 * causes all seasons to aggregate under "Fur Peace" on the leaderboard — which is
 * the correct behaviour (same franchise, just a rename).
 *
 * Championship years per master data: 2008, 2017, 2025
 * Super Bowl runner-up: 2022
 *
 * This script:
 *   1. Verifies award flags are correct for 2008, 2017, 2025 (and fixes if needed).
 *   2. Clears oldTeamName on ALL rows for teamId=45 so the entire franchise history
 *      aggregates under "Fur Peace".
 */

import { db } from '../lib/db';
import { standings } from '../schema';
import { eq, and } from 'drizzle-orm';

const TEAM_ID = 45; // Fur Peace (GFL, leagueId=1)

async function main() {
  // --- Step 1: Fetch all standings rows for this team ---
  const rows = await db
    .select({
      id: standings.id,
      year: standings.year,
      isChampion: standings.isChampion,
      isSuperBowl: standings.isSuperBowl,
      oldTeamName: standings.oldTeamName,
    })
    .from(standings)
    .where(eq(standings.teamId, TEAM_ID))
    .orderBy(standings.year);

  console.log(`Found ${rows.length} standings rows for teamId=${TEAM_ID}:`);
  rows.forEach(r =>
    console.log(
      `  year=${r.year}  isChampion=${r.isChampion}  isSuperBowl=${r.isSuperBowl}  oldTeamName=${r.oldTeamName ?? 'null'}`
    )
  );

  // --- Step 2: Fix award flags for championship / SB years ---
  const expectedAwards: Record<number, { isChampion: boolean; isSuperBowl: boolean }> = {
    2008: { isChampion: true, isSuperBowl: true },
    2017: { isChampion: true, isSuperBowl: true },
    2022: { isChampion: false, isSuperBowl: true },
    2025: { isChampion: true, isSuperBowl: true },
  };

  for (const row of rows) {
    const expected = expectedAwards[row.year];
    if (!expected) continue;

    const championMismatch = expected.isChampion !== row.isChampion;
    const sbMismatch = expected.isSuperBowl !== row.isSuperBowl;

    if (championMismatch || sbMismatch) {
      await db
        .update(standings)
        .set({ isChampion: expected.isChampion, isSuperBowl: expected.isSuperBowl })
        .where(eq(standings.id, row.id));
      console.log(
        `  FIXED awards year=${row.year}: isChampion ${row.isChampion}→${expected.isChampion}, isSuperBowl ${row.isSuperBowl}→${expected.isSuperBowl}`
      );
    } else {
      console.log(`  OK    awards year=${row.year}: isChampion=${row.isChampion}, isSuperBowl=${row.isSuperBowl}`);
    }
  }

  // --- Step 3: Clear oldTeamName on all rows for this team ---
  const rowsWithOldName = rows.filter(r => r.oldTeamName !== null);
  if (rowsWithOldName.length === 0) {
    console.log('\nNo oldTeamName values to clear — already clean.');
  } else {
    console.log(
      `\nClearing oldTeamName on ${rowsWithOldName.length} rows (years: ${rowsWithOldName.map(r => r.year).join(', ')})...`
    );
    const result = await db
      .update(standings)
      .set({ oldTeamName: null })
      .where(eq(standings.teamId, TEAM_ID));
    console.log(`  Done. Rows affected: ${(result as any).rowCount ?? 'unknown'}`);
  }

  // --- Step 4: Verify final state ---
  const final = await db
    .select({
      id: standings.id,
      year: standings.year,
      isChampion: standings.isChampion,
      isSuperBowl: standings.isSuperBowl,
      oldTeamName: standings.oldTeamName,
    })
    .from(standings)
    .where(eq(standings.teamId, TEAM_ID))
    .orderBy(standings.year);

  console.log('\nFinal state:');
  final.forEach(r =>
    console.log(
      `  year=${r.year}  isChampion=${r.isChampion}  isSuperBowl=${r.isSuperBowl}  oldTeamName=${r.oldTeamName ?? 'null'}`
    )
  );

  const championships = final.filter(r => r.isChampion).map(r => r.year);
  const superBowls = final.filter(r => r.isSuperBowl).map(r => r.year);
  const stillHasOldName = final.filter(r => r.oldTeamName !== null);

  console.log(`\nSummary:`);
  console.log(`  Championship years: ${championships.join(', ')}`);
  console.log(`  Super Bowl years:   ${superBowls.join(', ')}`);
  console.log(`  Rows still with oldTeamName: ${stillHasOldName.length}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
