import { db } from '../lib/db';
import { schedule } from '../schema';
import { and, eq } from 'drizzle-orm';

const rows = await db.select({ week: schedule.week, year: schedule.year, leagueId: schedule.leagueId })
  .from(schedule)
  .where(and(eq(schedule.year, 2026), eq(schedule.leagueId, 1)))
  .orderBy(schedule.week);

console.log(`2026 GFL schedule rows: ${rows.length}`);
if (rows.length > 0) console.log('Sample:', rows.slice(0, 3));
else {
  // Check what years exist
  const years = await db.selectDistinct({ year: schedule.year, leagueId: schedule.leagueId })
    .from(schedule)
    .where(eq(schedule.leagueId, 1));
  console.log('Years in DB for leagueId=1:', years.map(r => r.year).sort());
}
process.exit(0);
