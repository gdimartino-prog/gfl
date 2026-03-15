/**
 * Copies 2023 and 2024 schedule rows from GFL (league 1) to AFL (league 2).
 * Run: POSTGRES_URL="..." npx tsx scripts/copy-schedule-to-afl.ts
 */
import { db } from '../lib/db';
import { schedule } from '../schema';
import { eq, and, inArray } from 'drizzle-orm';

const SOURCE_LEAGUE = 1;
const TARGET_LEAGUE = 2;
const YEARS = ['2023', '2024'];

async function main() {
  // Check available years in GFL
  const allRows = await db.select().from(schedule).where(eq(schedule.leagueId, SOURCE_LEAGUE));
  const years = [...new Set(allRows.map(r => r.year?.toString()))].sort();
  console.log(`GFL schedule years available: ${years.join(', ')}`);

  // Get source rows for 2023 and 2024
  const sourceRows = allRows.filter(r => YEARS.includes(r.year?.toString() ?? ''));
  console.log(`Found ${sourceRows.length} GFL rows for years ${YEARS.join(', ')}`);

  if (sourceRows.length === 0) {
    console.error('No rows found to copy.');
    process.exit(1);
  }

  // Delete existing AFL rows for those years
  const existing = await db.select({ id: schedule.id }).from(schedule)
    .where(and(eq(schedule.leagueId, TARGET_LEAGUE), inArray(schedule.year, YEARS as string[])));
  if (existing.length > 0) {
    await db.delete(schedule).where(and(eq(schedule.leagueId, TARGET_LEAGUE), inArray(schedule.year, YEARS as string[])));
    console.log(`Deleted ${existing.length} existing AFL rows for years ${YEARS.join(', ')}`);
  }

  // Insert copies with leagueId = 2
  const toInsert = sourceRows.map(({ id, leagueId, ...rest }) => ({
    ...rest,
    leagueId: TARGET_LEAGUE,
    touch_id: 'copy-from-gfl',
  }));

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    await db.insert(schedule).values(batch);
    inserted += batch.length;
  }

  console.log(`Inserted ${inserted} AFL schedule rows for years ${YEARS.join(', ')}.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
