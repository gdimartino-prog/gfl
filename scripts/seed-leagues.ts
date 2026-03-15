/**
 * Seed script: creates the GFL league (id=1) and sets leagueId=1
 * on all existing rows across every tenant table.
 *
 * Run once:  npx tsx scripts/seed-leagues.ts
 */

import { db } from '../lib/db';
import { sql } from 'drizzle-orm';
import { leagues } from '../schema';

async function main() {
  console.log('Seeding leagues...');

  // 1. Insert GFL league (ignore if already exists)
  const [league] = await db
    .insert(leagues)
    .values({ name: 'Gridiron Fantasy League', slug: 'gfl', touch_id: 'seed' })
    .onConflictDoNothing()
    .returning();

  const leagueId = league?.id ?? 1;
  console.log(`Using league id=${leagueId} (GFL)`);

  // 2. Backfill all tenant tables with raw SQL
  const tenantTables = [
    'teams',
    'players',
    'transactions',
    'draft_picks',
    'cuts',
    'rules',
    'resources',
    'standings',
    'schedule',
    'trade_block',
    'audit_log',
  ];

  for (const tableName of tenantTables) {
    await db.execute(
      sql.raw(`UPDATE "${tableName}" SET league_id = ${leagueId} WHERE league_id IS NULL`)
    );
    console.log(`  ${tableName}: backfilled`);
  }

  console.log('\nDone! All existing rows assigned to league id=1 (GFL).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
