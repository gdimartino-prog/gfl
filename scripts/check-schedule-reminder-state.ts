import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../lib/db';
import { rules, schedule, teams } from '../schema';
import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

async function main() {
  // Show season-relevant rules for both leagues
  const seasonRules = ['cuts_year', 'current_nfl_week', 'schedule_due', 'draft_year'];
  for (const leagueId of [1, 2]) {
    console.log(`\n=== League ${leagueId} ===`);
    const rs = await db.select({ rule: rules.rule, value: rules.value, year: rules.year })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), isNull(rules.year)));
    const cfg: Record<string, string> = {};
    rs.forEach(r => { cfg[r.rule] = r.value; });
    for (const k of seasonRules) {
      console.log(`  ${k} = ${JSON.stringify(cfg[k] ?? '(unset)')}`);
    }
    const seasonYear = parseInt(cfg.cuts_year || '2025');
    const homeTeams = alias(teams, 'homeTeams');
    const awayTeams = alias(teams, 'awayTeams');
    const games = await db.select({
      week: schedule.week,
      homeScore: schedule.home_score,
      awayScore: schedule.away_score,
      home: homeTeams.name,
      away: awayTeams.name,
    })
      .from(schedule)
      .leftJoin(homeTeams, eq(schedule.homeTeamId, homeTeams.id))
      .leftJoin(awayTeams, eq(schedule.awayTeamId, awayTeams.id))
      .where(and(eq(schedule.leagueId, leagueId), eq(schedule.year, seasonYear)));
    console.log(`  games for ${seasonYear}: ${games.length}`);
    const unfinished = games.filter(g => g.homeScore === null);
    console.log(`  unfinished: ${unfinished.length}`);
    if (unfinished.length > 0) {
      const weeks = [...new Set(unfinished.map(g => g.week))].slice(0, 5);
      console.log(`  unfinished weeks (first 5): ${JSON.stringify(weeks)}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
