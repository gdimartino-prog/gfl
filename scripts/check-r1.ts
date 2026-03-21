import { db } from '../lib/db';
import { sql } from 'drizzle-orm';
async function main() {
  const r = await db.execute(sql`
    SELECT dp.round, dp.pick, t1.teamshort as original, t2.teamshort as current
    FROM draft_picks dp
    JOIN teams t1 ON t1.id = dp.original_team_id
    JOIN teams t2 ON t2.id = dp.current_team_id
    WHERE dp.league_id = 1 AND dp.year = 2026 AND dp.draft_type = 'free_agent'
      AND dp.round = 1
    ORDER BY dp.pick
  `);
  console.log('All round 1 picks:');
  (r as any).rows.forEach((x: any) => console.log(`  P${x.pick} original=${x.original} current=${x.current} ${x.original !== x.current ? '<-- TRADED' : ''}`));
  
  const pt = await db.execute(sql`
    SELECT pt.round, t1.teamshort as original, t2.teamshort as current
    FROM draft_pick_transfers pt
    JOIN teams t1 ON t1.id = pt.original_team_id
    JOIN teams t2 ON t2.id = pt.current_team_id
    WHERE pt.league_id = 1 AND pt.year = 2026 AND pt.draft_type = 'free_agent'
    ORDER BY pt.round
  `);
  console.log('\ndraft_pick_transfers:');
  (pt as any).rows.forEach((x: any) => console.log(`  R${x.round}: ${x.original} → ${x.current}`));
}
main().catch(console.error).finally(() => process.exit(0));
