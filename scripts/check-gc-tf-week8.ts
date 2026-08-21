import { db } from '../lib/db';
import { teams, schedule } from '../schema';
import { eq, and, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const home = alias(teams, 'home');
const away = alias(teams, 'away');

const rows = await db.select({
  id: schedule.id,
  year: schedule.year,
  week: schedule.week,
  awayName: away.name,
  awayId: schedule.awayTeamId,
  awayScore: schedule.away_score,
  homeName: home.name,
  homeId: schedule.homeTeamId,
  homeScore: schedule.home_score,
  isBye: schedule.is_bye,
})
.from(schedule)
.leftJoin(home, eq(schedule.homeTeamId, home.id))
.leftJoin(away, eq(schedule.awayTeamId, away.id))
.where(and(
  eq(schedule.leagueId, 1),
  eq(schedule.week, '8'),
  sql`(${home.name} ILIKE '%tinton%' OR ${away.name} ILIKE '%gotham%' OR ${home.name} ILIKE '%gotham%' OR ${away.name} ILIKE '%tinton%')`,
));

console.log('Week 8 rows matching Gotham/Tinton:');
console.log(JSON.stringify(rows, null, 2));
process.exit(0);
