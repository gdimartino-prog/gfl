import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

const res = await db.execute(sql`
  ALTER TABLE players ADD COLUMN IF NOT EXISTS espn_id VARCHAR(20);
`);
console.log('Done:', res);
process.exit(0);
