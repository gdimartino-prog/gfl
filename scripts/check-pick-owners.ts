import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

// Find all draft picks for league 1, showing their current team info
const result = await db.execute(sql`
  SELECT dp.id, dp.pick, dp.round, dp.year, dp.draft_type,
    dp.original_team_id, dp.current_team_id,
    t_orig.teamshort AS original_team,
    t_curr.teamshort AS current_team,
    t_curr.league_id AS current_team_league,
    dp.selected_player_name, dp.picked_at
  FROM draft_picks dp
  LEFT JOIN teams t_orig ON t_orig.id = dp.original_team_id
  LEFT JOIN teams t_curr ON t_curr.id = dp.current_team_id
  WHERE dp.league_id = 1
    AND dp.year = 2026
  ORDER BY dp.pick, dp.id
`);

console.log('id\tpick\tround\tdraft_type\torig_team\tcurr_team\tcurr_league\tplayer\tpicked_at');
for (const r of result.rows as any[]) {
  console.log(`${r.id}\t${r.pick}\t${r.round}\t${r.draft_type}\t${r.original_team}\t${r.current_team}\t${r.current_team_league}\t${r.selected_player_name ?? ''}\t${r.picked_at ?? ''}`);
}
