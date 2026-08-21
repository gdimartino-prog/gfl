import 'dotenv/config';
import { db } from '../lib/db';
import { draftPicks, pickTransfers, teams } from '../schema';
import { and, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const LEAGUE_ID = 1;

async function getTeamId(teamshort: string): Promise<number> {
  const row = await db.select({ id: teams.id }).from(teams)
    .where(and(eq(teams.teamshort, teamshort), eq(teams.leagueId, LEAGUE_ID)))
    .limit(1);
  if (!row[0]) throw new Error(`Team not found: ${teamshort}`);
  return row[0].id;
}

async function fixOwner(label: string, year: number, round: number, originalShort: string, newOwnerShort: string) {
  const originalTeamId = await getTeamId(originalShort);
  const newOwnerId = await getTeamId(newOwnerShort);

  const [ptUpdated, dpUpdated] = await Promise.all([
    db.update(pickTransfers)
      .set({ currentTeamId: newOwnerId })
      .where(and(
        eq(pickTransfers.leagueId, LEAGUE_ID),
        eq(pickTransfers.year, year),
        eq(pickTransfers.round, round),
        eq(pickTransfers.draftType, 'free_agent'),
        eq(pickTransfers.originalTeamId, originalTeamId),
      )),
    db.update(draftPicks)
      .set({ currentTeamId: newOwnerId })
      .where(and(
        eq(draftPicks.leagueId, LEAGUE_ID),
        eq(draftPicks.year, year),
        eq(draftPicks.round, round),
        eq(draftPicks.draftType, 'free_agent'),
        eq(draftPicks.originalTeamId, originalTeamId),
      )),
  ]);

  console.log(`✓ ${label}: updated pick_transfers + draft_picks → ${newOwnerShort}`);
}

async function addMissingTransfer(label: string, overall: number, newOwnerShort: string) {
  const pick = await db.select({
    id: draftPicks.id,
    year: draftPicks.year,
    round: draftPicks.round,
    draftType: draftPicks.draftType,
    originalTeamId: draftPicks.originalTeamId,
  }).from(draftPicks)
    .where(and(
      eq(draftPicks.leagueId, LEAGUE_ID),
      eq(draftPicks.pick, overall),
    ))
    .limit(1);

  if (!pick[0]) throw new Error(`Pick #${overall} not found`);
  const { id, year, round, draftType, originalTeamId } = pick[0];
  if (!originalTeamId) throw new Error(`Pick #${overall} has no originalTeamId`);

  const newOwnerId = await getTeamId(newOwnerShort);

  await Promise.all([
    db.insert(pickTransfers)
      .values({ leagueId: LEAGUE_ID, year, draftType, round, originalTeamId, currentTeamId: newOwnerId, touch_id: 'fix-script' })
      .onConflictDoUpdate({
        target: [pickTransfers.leagueId, pickTransfers.year, pickTransfers.draftType, pickTransfers.round, pickTransfers.originalTeamId],
        set: { currentTeamId: newOwnerId, touch_id: 'fix-script', touch_dt: sql`now()` },
      }),
    db.update(draftPicks)
      .set({ currentTeamId: newOwnerId })
      .where(eq(draftPicks.id, id)),
  ]);

  console.log(`✓ ${label}: inserted pick_transfers + updated draft_picks → ${newOwnerShort}`);
}

async function main() {
  console.log('Fixing traded picks...\n');

  // Fix 1: 2026 Rd1 #15 LBI→CK (missing transfer)
  await addMissingTransfer('2026 Rd1 #15 LBI→CK', 15, 'CK');

  // Fix 2: 2026 Rd3 SG→OBG, currently SG→DC
  await fixOwner('2026 Rd3 SG→OBG', 2026, 3, 'SG', 'OBG');

  console.log('\nDone.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
