// Sets oldTeamName = 'Tinton Falls' on Fur Peace GFL (teamId=45) rows from 2004-2020
import { db } from '../lib/db';
import { standings } from '../schema';
import { and, eq, lte } from 'drizzle-orm';

const JACK_WYVILLE_TEAM_ID = 45;

const rows = await db.select({ id: standings.id, year: standings.year })
  .from(standings)
  .where(and(eq(standings.teamId, JACK_WYVILLE_TEAM_ID), lte(standings.year, 2020)));

console.log(`Updating ${rows.length} rows (2004-2020) → oldTeamName = 'Tinton Falls'`);

for (const row of rows) {
  await db.update(standings)
    .set({ oldTeamName: 'Tinton Falls' })
    .where(eq(standings.id, row.id));
  console.log(`  Year ${row.year} updated`);
}

console.log('Done.');
process.exit(0);
