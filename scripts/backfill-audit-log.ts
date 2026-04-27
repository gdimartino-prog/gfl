import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

const result = await db.execute(sql`UPDATE audit_log SET league_id = 1 WHERE league_id IS NULL`);
console.log('Backfilled audit_log rows:', result.rowCount);

const check = await db.execute(sql`SELECT COUNT(*) as n FROM audit_log WHERE league_id IS NULL`);
console.log('Remaining NULLs:', (check.rows[0] as { n: string }).n);

process.exit(0);
