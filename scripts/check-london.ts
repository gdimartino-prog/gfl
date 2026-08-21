import { db } from '../lib/db';
import { standings, teams } from '../schema';
import { eq, and } from 'drizzle-orm';

const rows = await db.select({ id: standings.id, year: standings.year, coachName: standings.coachName })
  .from(standings)
  .leftJoin(teams, eq(standings.teamId, teams.id))
  .where(and(eq(teams.name, 'London'), eq(standings.leagueId, 1)));

rows.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)).forEach(r => console.log(r));
process.exit(0);
