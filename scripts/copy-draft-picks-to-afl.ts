/**
 * Copy draft picks from league 1 (GFL) to league 2 (AFL).
 *
 * - Maps GFL team IDs to AFL team IDs by matching teamshort
 * - Skips playerID references (clears them — AFL is a fresh league)
 * - Skips picks that already exist in AFL (year + round + pick)
 *
 * Run: POSTGRES_URL="..." npx tsx scripts/copy-draft-picks-to-afl.ts
 */

import { db } from '../lib/db';
import { eq, and } from 'drizzle-orm';
import { teams, draftPicks } from '../schema';

const GFL_LEAGUE_ID = 1;
const AFL_LEAGUE_ID = 2;

async function main() {
  // 1. Load all teams for both leagues
  const gflTeams = await db.select().from(teams).where(eq(teams.leagueId, GFL_LEAGUE_ID));
  const aflTeams = await db.select().from(teams).where(eq(teams.leagueId, AFL_LEAGUE_ID));

  console.log(`GFL teams: ${gflTeams.length}`);
  console.log(`AFL teams: ${aflTeams.length}`);

  if (aflTeams.length === 0) {
    console.error('No AFL teams found (leagueId=2). Make sure AFL teams exist before running this script.');
    process.exit(1);
  }

  // 2. Build GFL teamId → AFL teamId map (matched by teamshort)
  const teamIdMap = new Map<number, number>();
  for (const gfl of gflTeams) {
    const afl = aflTeams.find(
      (t) => t.teamshort?.toLowerCase() === gfl.teamshort?.toLowerCase()
    );
    if (afl) {
      teamIdMap.set(gfl.id, afl.id);
    } else {
      console.warn(`  WARNING: No AFL team matching GFL teamshort="${gfl.teamshort}" (id=${gfl.id}) — picks owned by this team will be skipped`);
    }
  }

  console.log(`\nTeam mappings found: ${teamIdMap.size} / ${gflTeams.length}`);
  for (const [gflId, aflId] of teamIdMap) {
    const g = gflTeams.find(t => t.id === gflId);
    const a = aflTeams.find(t => t.id === aflId);
    console.log(`  GFL ${g?.teamshort} (id=${gflId}) → AFL ${a?.teamshort} (id=${aflId})`);
  }

  // 3. Load GFL draft picks
  const gflPicks = await db.select().from(draftPicks).where(eq(draftPicks.leagueId, GFL_LEAGUE_ID));
  console.log(`\nGFL draft picks to copy: ${gflPicks.length}`);

  // 4. Load existing AFL picks to avoid duplicates
  const existingAflPicks = await db.select().from(draftPicks).where(eq(draftPicks.leagueId, AFL_LEAGUE_ID));
  const existingSet = new Set(
    existingAflPicks.map(p => `${p.year}-${p.round}-${p.pick}`)
  );
  console.log(`Existing AFL picks (will skip): ${existingAflPicks.length}`);

  // 5. Copy picks
  let inserted = 0;
  let skipped = 0;
  let unmapped = 0;

  for (const pick of gflPicks) {
    const key = `${pick.year}-${pick.round}-${pick.pick}`;

    if (existingSet.has(key)) {
      console.log(`  SKIP (already exists): R${pick.round} #${pick.pick} (${pick.year})`);
      skipped++;
      continue;
    }

    const newOriginalTeamId = pick.originalTeamId ? teamIdMap.get(pick.originalTeamId) : null;
    const newCurrentTeamId  = pick.currentTeamId  ? teamIdMap.get(pick.currentTeamId)  : null;

    if (pick.originalTeamId && !newOriginalTeamId) {
      console.warn(`  SKIP (unmapped originalTeam id=${pick.originalTeamId}): R${pick.round} #${pick.pick} (${pick.year})`);
      unmapped++;
      continue;
    }

    if (pick.currentTeamId && !newCurrentTeamId) {
      console.warn(`  SKIP (unmapped currentTeam id=${pick.currentTeamId}): R${pick.round} #${pick.pick} (${pick.year})`);
      unmapped++;
      continue;
    }

    await db.insert(draftPicks).values({
      leagueId:            AFL_LEAGUE_ID,
      year:                pick.year,
      round:               pick.round,
      pick:                pick.pick,
      originalTeamId:      newOriginalTeamId ?? null,
      currentTeamId:       newCurrentTeamId  ?? null,
      playerId:            null,           // clear — AFL starts fresh
      pickedAt:            null,
      warningSent:         false,
      selectedPlayerName:  null,
      touch_id:            'copy-from-gfl',
    });

    console.log(`  INSERTED: R${pick.round} #${pick.pick} (${pick.year}) → ${aflTeams.find(t => t.id === newCurrentTeamId)?.teamshort}`);
    inserted++;
  }

  console.log(`\nDone.`);
  console.log(`  Inserted:  ${inserted}`);
  console.log(`  Skipped:   ${skipped} (already existed)`);
  console.log(`  Unmapped:  ${unmapped} (no matching AFL team)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
