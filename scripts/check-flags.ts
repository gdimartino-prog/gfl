import { db } from '../lib/db';
import { standings, teams } from '../schema';
import { eq, and } from 'drizzle-orm';

const champs = await db.select({ year: standings.year, team: teams.name })
  .from(standings)
  .innerJoin(teams, eq(standings.teamId, teams.id))
  .where(and(eq(standings.leagueId, 1), eq(standings.isChampion, true)))
  .orderBy(standings.year);

console.log('Champions by year:');
champs.forEach(r => console.log(`  ${r.year}: ${r.team}`));

const sbTotal = await db.select({ year: standings.year, team: teams.name })
  .from(standings)
  .innerJoin(teams, eq(standings.teamId, teams.id))
  .where(and(eq(standings.leagueId, 1), eq(standings.isSuperBowl, true)))
  .orderBy(standings.year);

console.log(`\nSuper Bowl appearances: ${sbTotal.length}`);
sbTotal.forEach(r => console.log(`  ${r.year}: ${r.team}`));
