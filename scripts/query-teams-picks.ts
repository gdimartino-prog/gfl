import { db } from '../lib/db';
import { teams, draftPicks } from '../schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  const ts = await db.select({ id: teams.id, short: teams.teamshort, name: teams.name }).from(teams).where(eq(teams.leagueId, 1));
  console.log('TEAMS:');
  ts.forEach(t => console.log(`  ${t.id} | ${t.short} | ${t.name}`));

  const picks = await db.execute(sql`SELECT year, draft_type, count(*) as cnt, max(round) as max_round FROM draft_picks WHERE league_id=1 GROUP BY year, draft_type ORDER BY year, draft_type`);
  console.log('\nDRAFT PICKS SUMMARY:');
  (picks as any).rows.forEach((r: any) => console.log(`  ${r.year} ${r.draft_type}: ${r.cnt} picks, ${r.max_round} rounds`));
}
main().catch(console.error).finally(() => process.exit(0));
