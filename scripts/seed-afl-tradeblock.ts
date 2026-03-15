/**
 * Seeds AFL (league 2) trade block with sample players from multiple teams.
 * Run: POSTGRES_URL="..." npx tsx scripts/seed-afl-tradeblock.ts
 */
import { db } from '../lib/db';
import { tradeBlock } from '../schema';
import { eq } from 'drizzle-orm';

const AFL_LEAGUE_ID = 2;

const entries = [
  // Fur Peace Ranch
  { playerId: 'afl|justin|jefferson|27|wr', playerName: 'Justin Jefferson',    team: 'FPR', position: 'WR', asking: '1st round pick + starter' },
  { playerId: 'afl|travis|kelce|35|te',     playerName: 'Travis Kelce',        team: 'FPR', position: 'TE', asking: 'TE or 2nd round pick' },
  // Tinton Falls Thunder
  { playerId: 'afl|lamar|jackson|27|qb',    playerName: 'Lamar Jackson',       team: 'TFT', position: 'QB', asking: 'Package deal only' },
  { playerId: 'afl|amon-ra|st|brown|24|wr', playerName: "Amon-Ra St. Brown",   team: 'TFT', position: 'WR', asking: '2 picks or WR swap' },
  // Amalfi Coast
  { playerId: 'afl|ceedee|lamb|25|wr',      playerName: 'CeeDee Lamb',         team: 'AFL', position: 'WR', asking: '1st + CB' },
  // DC Capital
  { playerId: 'afl|christian|mccaffrey|28|rb', playerName: 'Christian McCaffrey', team: 'DC', position: 'RB', asking: 'Elite WR or 2 firsts' },
  { playerId: 'afl|tee|higgins|26|wr',      playerName: 'Tee Higgins',         team: 'DC', position: 'WR', asking: '2nd round pick' },
  // Tampa Charge
  { playerId: 'afl|brock|purdy|25|qb',      playerName: 'Brock Purdy',         team: 'TC', position: 'QB', asking: 'Starter + pick' },
  // Kigali Kings
  { playerId: 'afl|sam|darnold|27|qb',      playerName: 'Sam Darnold',         team: 'Kig', position: 'QB', asking: 'Best offer' },
  // Carolina Thunder
  { playerId: 'afl|deebo|samuel|29|wr',     playerName: 'Deebo Samuel',        team: 'CT', position: 'WR', asking: '2nd or CB' },
];

async function main() {
  // Clear existing AFL trade block entries first
  const deleted = await db.delete(tradeBlock).where(eq(tradeBlock.leagueId, AFL_LEAGUE_ID)).returning({ id: tradeBlock.id });
  console.log(`Cleared ${deleted.length} existing AFL trade block entries.`);

  for (const e of entries) {
    await db.insert(tradeBlock).values({
      leagueId: AFL_LEAGUE_ID,
      playerId: e.playerId,
      playerName: e.playerName,
      team: e.team,
      position: e.position,
      asking: e.asking,
      touch_id: 'seed',
    }).onConflictDoUpdate({
      target: tradeBlock.playerId,
      set: { leagueId: AFL_LEAGUE_ID, playerName: e.playerName, team: e.team, position: e.position, asking: e.asking, touch_id: 'seed' },
    });
  }

  console.log(`Seeded ${entries.length} AFL trade block entries across ${new Set(entries.map(e => e.team)).size} teams.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
