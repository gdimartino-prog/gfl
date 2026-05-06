// Sets oldTeamName = 'London' on all Jefferson (teamId=50) standings rows
// Run: POSTGRES_URL="..." npx tsx scripts/fix-london-rename.ts
import { db } from '../lib/db';
import { standings } from '../schema';
import { eq } from 'drizzle-orm';

const JEFFERSON_TEAM_ID = 50;

const rows = await db.select({ id: standings.id, year: standings.year })
  .from(standings)
  .where(eq(standings.teamId, JEFFERSON_TEAM_ID));

console.log(`Found ${rows.length} standings rows for Jefferson (teamId=${JEFFERSON_TEAM_ID})`);

for (const row of rows) {
  await db.update(standings)
    .set({ oldTeamName: 'London' })
    .where(eq(standings.id, row.id));
  console.log(`  Updated year ${row.year} → oldTeamName = 'London'`);
}

console.log('Done.');
process.exit(0);
