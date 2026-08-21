import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../lib/db';
import { rules, draftPicks } from '../schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

async function main() {
  for (const leagueId of [1, 2]) {
    console.log(`\n=== League ${leagueId} ===`);
    const draftYearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_year'), isNull(rules.year))).limit(1);
    const startRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_start_date'), isNull(rules.year))).limit(1);
    const draftYear = draftYearRow[0]?.value ?? '(unset)';
    const startDate = startRow[0]?.value ?? '(unset)';
    console.log(`  draft_year:           ${draftYear}`);
    console.log(`  draft_start_date:     ${startDate}`);

    if (draftYear !== '(unset)') {
      const completeKey = `draft_complete_${draftYear}`;
      const completeRow = await db.select({ value: rules.value })
        .from(rules)
        .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, completeKey), isNull(rules.year))).limit(1);
      console.log(`  ${completeKey}: ${completeRow[0]?.value ?? '(unset)'}`);

      const totalRow = await db.select({ count: sql<number>`count(*)::int` })
        .from(draftPicks)
        .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, parseInt(draftYear))));
      const undraftedRow = await db.select({ count: sql<number>`count(*)::int` })
        .from(draftPicks)
        .where(and(
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.year, parseInt(draftYear)),
          isNull(draftPicks.pickedAt),
          eq(draftPicks.passed, false),
        ));
      console.log(`  picks for ${draftYear}:    ${totalRow[0]?.count ?? 0}`);
      console.log(`  undrafted (active):   ${undraftedRow[0]?.count ?? 0}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
