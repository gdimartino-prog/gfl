import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  await db.execute(sql`ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS passed boolean NOT NULL DEFAULT false`);
  console.log('✓ passed column added to draft_picks');
}

run().catch(console.error);
