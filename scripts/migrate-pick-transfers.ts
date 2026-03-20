/**
 * One-time migration: create pick_transfers table
 * Run with: npx tsx scripts/migrate-pick-transfers.ts
 */
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Creating pick_transfers table...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pick_transfers (
      id SERIAL PRIMARY KEY,
      league_id INTEGER REFERENCES leagues(id),
      year INTEGER NOT NULL,
      draft_type VARCHAR(20) NOT NULL DEFAULT 'free_agent',
      round INTEGER NOT NULL,
      original_team_id INTEGER REFERENCES teams(id),
      current_team_id INTEGER REFERENCES teams(id),
      touch_dt TIMESTAMP NOT NULL DEFAULT NOW(),
      touch_id VARCHAR(256),
      CONSTRAINT pick_transfers_unique_owner UNIQUE (league_id, year, draft_type, round, original_team_id)
    )
  `);

  console.log('✅ pick_transfers table created (or already exists).');
}

main().catch(err => { console.error(err); process.exit(1); });
