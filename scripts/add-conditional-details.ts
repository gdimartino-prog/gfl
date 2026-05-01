import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS conditional_details text`);
console.log('ALTER TABLE done');

const r = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='transactions' AND column_name='conditional_details'`);
console.log(r.rows.length ? '✓ conditional_details column confirmed in DB' : '✗ conditional_details column still missing');
process.exit(0);
