import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

const r = await db.execute(sql`
  SELECT DISTINCT offense, defense, special, position, COUNT(*) as cnt
  FROM players
  WHERE league_id = 1 AND team_id IS NULL
  GROUP BY offense, defense, special, position
  ORDER BY offense NULLS LAST, cnt DESC
  LIMIT 60
`);
console.log('offense\tdefense\tspecial\tposition\tcnt');
for (const row of r.rows as any[]) {
  console.log(`${row.offense ?? 'null'}\t${row.defense ?? 'null'}\t${row.special ?? 'null'}\t${row.position ?? 'null'}\t${row.cnt}`);
}
