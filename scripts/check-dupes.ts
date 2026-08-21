import { db } from '../lib/db';
import { players } from '../schema';
import { eq, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Find FA players with duplicate names
const dupes = await db.execute(sql`
  SELECT name, COUNT(*) as cnt, array_agg(id) as ids, array_agg(identity) as identities
  FROM players
  WHERE league_id = 1 AND team_id IS NULL
  GROUP BY name
  HAVING COUNT(*) > 1
  ORDER BY cnt DESC
  LIMIT 20
`);

console.log('Duplicate FA players:');
dupes.rows.forEach((r: Record<string, unknown>) => console.log(r));
process.exit(0);
