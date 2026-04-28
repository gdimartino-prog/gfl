import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

const result = await db.execute(sql`
  SELECT t.id, t.teamshort, t.name, t.coach, COUNT(p.id) as player_count
  FROM teams t
  LEFT JOIN players p ON p.team_id = t.id
  WHERE t.league_id = 1
  GROUP BY t.id, t.teamshort, t.name, t.coach
  ORDER BY t.name
`);
console.log(JSON.stringify(result.rows, null, 2));
process.exit(0);
