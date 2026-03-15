import { config } from 'dotenv';
config({ path: '.env.local' });

import { createPool } from '@vercel/postgres';

async function main() {
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });

  const alterStatements = [
    `ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS picked_at TIMESTAMP`,
    `ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS warning_sent BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS selected_player_name VARCHAR(256)`,
  ];

  for (const sql of alterStatements) {
    console.log(`Running: ${sql}`);
    await pool.query(sql);
    console.log('  OK');
  }

  // Verify
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'draft_picks'
      AND column_name IN ('picked_at', 'warning_sent', 'selected_player_name')
    ORDER BY column_name
  `);

  console.log('\nVerification — new columns:');
  for (const row of result.rows) {
    console.log(`  ${row.column_name}: ${row.data_type}, nullable=${row.is_nullable}, default=${row.column_default}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
