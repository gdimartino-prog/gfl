import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Creating nfl_draft table...');
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nfl_draft (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      round INTEGER NOT NULL,
      pick INTEGER NOT NULL,
      round_pick INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      position TEXT,
      nfl_team TEXT,
      college TEXT
    )
  `);
  console.log('Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
