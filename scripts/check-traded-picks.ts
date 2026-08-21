import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

const result = await db.execute(sql`
  SELECT
    dp.year, dp.round, dp.pick as overall,
    ot.teamshort as original_team,
    ct.teamshort as current_owner
  FROM draft_picks dp
  JOIN teams ot ON ot.id = dp.original_team_id
  JOIN teams ct ON ct.id = dp.current_team_id
  WHERE dp.league_id = 1
    AND dp.original_team_id != dp.current_team_id
  ORDER BY dp.year, dp.round, dp.pick
`);

console.log('year\tround\toverall\toriginal_team\tcurrent_owner');
for (const r of result.rows as any[]) {
  console.log(`${r.year}\t${r.round}\t${r.overall}\t${r.original_team}\t${r.current_owner}`);
}
console.log(`\nTotal: ${result.rows.length}`);
process.exit(0);
