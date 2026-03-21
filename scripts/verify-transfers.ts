import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const r = await db.execute(sql`
    SELECT dp.round, t1.teamshort as original, t2.teamshort as current, pt.current_team_id IS NOT NULL as in_transfers
    FROM draft_picks dp
    LEFT JOIN teams t1 ON t1.id = dp.original_team_id
    LEFT JOIN teams t2 ON t2.id = dp.current_team_id
    LEFT JOIN draft_pick_transfers pt ON pt.league_id = dp.league_id AND pt.year = dp.year AND pt.draft_type = dp.draft_type AND pt.round = dp.round AND pt.original_team_id = dp.original_team_id
    WHERE dp.league_id = 1 AND dp.year = 2026 AND dp.draft_type = 'free_agent'
      AND dp.original_team_id != dp.current_team_id
    ORDER BY dp.round
  `);
  console.log('Round | Original → Current | In transfers table');
  (r as any).rows.forEach((x: any) => console.log(`  R${x.round}: ${x.original} → ${x.current} | ${x.in_transfers ? '✓' : '✗'}`));
  console.log(`\nTotal traded picks: ${(r as any).rows.length}`);
}
main().catch(console.error).finally(() => process.exit(0));
