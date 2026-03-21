import { db } from '../lib/db';
import { draftPicks, teams } from '../schema';
import { eq, sql, and } from 'drizzle-orm';

async function main() {
  // Show first 20 picks of 2026 FA draft with team info
  const picks = await db.execute(sql`
    SELECT dp.round, dp.pick, t1.teamshort as original, t2.teamshort as current
    FROM draft_picks dp
    LEFT JOIN teams t1 ON t1.id = dp.original_team_id
    LEFT JOIN teams t2 ON t2.id = dp.current_team_id
    WHERE dp.league_id = 1 AND dp.year = 2026 AND dp.draft_type = 'free_agent'
    ORDER BY dp.round, dp.pick
    LIMIT 25
  `);
  console.log('Round | Pick | Original | Current');
  (picks as any).rows.forEach((r: any) => console.log(`  R${r.round} P${r.pick} | ${r.original} | ${r.current}`));
  
  // Also check the TFT duplicate
  const tft = await db.execute(sql`SELECT id, teamshort, name, status FROM teams WHERE teamshort = 'TFT'`);
  console.log('\nTFT teams:', JSON.stringify((tft as any).rows));
}
main().catch(console.error).finally(() => process.exit(0));
