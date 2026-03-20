/**
 * One-time migration: create draft_pick_transfers table (renamed from pick_transfers)
 * Run with: npx tsx scripts/migrate-pick-transfers.ts
 */
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Renaming pick_transfers → draft_pick_transfers...');

  // Rename if old table exists
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pick_transfers') THEN
        ALTER TABLE pick_transfers RENAME TO draft_pick_transfers;
        ALTER TABLE draft_pick_transfers RENAME CONSTRAINT pick_transfers_unique_owner TO draft_pick_transfers_unique_owner;
      ELSE
        CREATE TABLE IF NOT EXISTS draft_pick_transfers (
          id SERIAL PRIMARY KEY,
          league_id INTEGER REFERENCES leagues(id),
          year INTEGER NOT NULL,
          draft_type VARCHAR(20) NOT NULL DEFAULT 'free_agent',
          round INTEGER NOT NULL,
          original_team_id INTEGER REFERENCES teams(id),
          current_team_id INTEGER REFERENCES teams(id),
          touch_dt TIMESTAMP NOT NULL DEFAULT NOW(),
          touch_id VARCHAR(256),
          CONSTRAINT draft_pick_transfers_unique_owner UNIQUE (league_id, year, draft_type, round, original_team_id)
        );
      END IF;
    END $$;
  `);

  console.log('✅ draft_pick_transfers table ready.');
}

main().catch(err => { console.error(err); process.exit(1); });
