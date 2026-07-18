import { db } from '../lib/db';
import { players, teams } from '../schema';
import { eq, and, isNull, isNotNull, not, sql } from 'drizzle-orm';

const rows = await db.select({
  teamshort: teams.teamshort,
  first: players.first,
  last: players.last,
  pos: players.position,
}).from(players)
  .innerJoin(teams, and(eq(players.teamId, teams.id), eq(teams.leagueId, 1)))
  .where(and(
    isNull(players.espnId),
    isNotNull(players.teamId),
    eq(players.leagueId, 1),
    not(sql`upper(coalesce(${players.offense}, ${players.defense}, ${players.special}, ${players.position}, '')) = ANY(ARRAY['OL','OT','OG','C','G','T'])`),
  ));

console.log(`${rows.length} unmatched skill players:\n`);
console.log(rows.map(r => `${r.teamshort}: ${r.first} ${r.last} (${r.pos})`).join('\n'));
process.exit(0);
