import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

await db.execute(sql`
  ALTER TABLE draft_pick_transfers
  ADD COLUMN IF NOT EXISTS history integer[] NOT NULL DEFAULT '{}'
`);
console.log('✓ Added history column to draft_pick_transfers');
process.exit(0);
