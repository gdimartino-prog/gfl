/**
 * Enable Row Level Security on all app tables.
 * Run after any schema migration (db:push) that creates/recreates tables.
 * Run: npx tsx scripts/enable-rls.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

// Dynamic imports AFTER env is loaded — static imports are hoisted and
// would evaluate lib/db before POSTGRES_URL is set.
const { db } = await import('../lib/db');
const { sql } = await import('drizzle-orm');

// Query all tables in the public schema dynamically so newly added
// tables or non-standard tables (e.g. nfl_draft) are never missed.
const result = await db.execute<{ tablename: string; rowsecurity: boolean }>(sql`
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
`);

const allTables = result.rows;
console.log(`Discovered ${allTables.length} tables in public schema.\n`);

const failures: string[] = [];
for (const { tablename, rowsecurity } of allTables) {
  try {
    await db.execute(sql.raw(`ALTER TABLE "${tablename}" ENABLE ROW LEVEL SECURITY`));
    console.log(`✓ RLS enabled: ${tablename}${rowsecurity ? ' (was already enabled)' : ' (ENABLED)'}`);
  } catch (e: any) {
    console.log(`  FAIL: ${tablename} - ${e.message}`);
    failures.push(tablename);
  }
}

if (failures.length > 0) {
  console.error(`\nRLS NOT enabled on: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('\nDone.');
process.exit(0);
