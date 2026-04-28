import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

const result = await db.execute(sql`
  SELECT first, last, scouting->>'salary' as salary, scouting IS NOT NULL as has_scouting
  FROM players
  WHERE team_id IS NULL
  LIMIT 10
`);
console.log(JSON.stringify(result.rows, null, 2));
process.exit(0);
