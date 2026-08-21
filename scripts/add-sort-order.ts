import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  await db.execute(sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0`);
  console.log('Done: sort_order column added to resources table.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
