import { db } from '../lib/db';
import { standings, teams } from '../schema';
import { eq } from 'drizzle-orm';

const allTeams = await db.select().from(teams).where(eq(teams.name, 'Fur Peace'));
console.log('Teams named Fur Peace:', JSON.stringify(allTeams, null, 2));

const rows = await db.select({
  id: standings.id,
  year: standings.year,
  teamId: standings.teamId,
  teamName: teams.name,
  coachName: standings.coachName,
  oldTeamName: standings.oldTeamName,
}).from(standings)
  .leftJoin(teams, eq(standings.teamId, teams.id))
  .where(eq(teams.name, 'Fur Peace'))
  .orderBy(standings.year);

rows.forEach(r => console.log(`year=${r.year}  teamId=${r.teamId}  coachName="${r.coachName}"  oldTeamName="${r.oldTeamName}"`));
process.exit(0);
