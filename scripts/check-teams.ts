import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

const result = await db.execute(sql`
  SELECT id, name, teamshort, nickname, status, league_id
  FROM teams
  WHERE league_id = 1
  ORDER BY teamshort
`);

console.log('id\tname\tteamshort\tnickname\tstatus');
for (const r of result.rows as any[]) {
  console.log(`${r.id}\t${r.name}\t${r.teamshort}\t${r.nickname}\t${r.status}`);
}
