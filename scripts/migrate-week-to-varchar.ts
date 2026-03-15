import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

await db.execute(sql`ALTER TABLE schedule ALTER COLUMN week TYPE varchar(10) USING week::text`);
console.log('Done. week column changed from integer to varchar(10).');
process.exit(0);
