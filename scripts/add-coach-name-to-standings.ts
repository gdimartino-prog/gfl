import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Adding coach_name column to standings...');
  await db.execute(sql`ALTER TABLE standings ADD COLUMN IF NOT EXISTS coach_name VARCHAR(256)`);

  console.log('Backfilling coach_name from current teams.coach...');
  await db.execute(sql`
    UPDATE standings s
    SET coach_name = t.coach
    FROM teams t
    WHERE s.team_id = t.id
      AND s.coach_name IS NULL
      AND t.coach IS NOT NULL
  `);

  const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM standings WHERE coach_name IS NOT NULL`);
  console.log(`Done. ${result.rows[0].cnt} rows backfilled.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
