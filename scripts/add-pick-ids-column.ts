import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pick_ids integer[]`);
console.log('ALTER TABLE done');

const r = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='transactions' AND column_name='pick_ids'`);
console.log(r.rows.length ? '✓ pick_ids column confirmed in DB' : '✗ pick_ids column still missing');
process.exit(0);
