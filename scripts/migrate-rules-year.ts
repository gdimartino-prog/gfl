import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

// 1. Add nullable year column
await db.execute(sql`ALTER TABLE rules ADD COLUMN IF NOT EXISTS year integer`);
console.log('Added year column.');

// 2. Drop old unique index
await db.execute(sql`DROP INDEX IF EXISTS rules_league_rule_unique`);
console.log('Dropped old unique index.');

// 3. Create new unique constraint with NULLS NOT DISTINCT (PostgreSQL 15+)
await db.execute(sql`
  CREATE UNIQUE INDEX IF NOT EXISTS rules_league_year_rule_unique
  ON rules (league_id, year, rule) NULLS NOT DISTINCT
`);
console.log('Created new unique index with NULLS NOT DISTINCT.');

console.log('Done.');
process.exit(0);
