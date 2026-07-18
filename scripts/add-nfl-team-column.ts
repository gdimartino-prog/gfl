import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS nfl_team VARCHAR(100)`);
console.log('Done');
process.exit(0);
