import { db } from '../lib/db';
import { players } from '../schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

const rows = await db
  .select({ name: players.name, scouting: players.scouting, special: players.special, position: players.position })
  .from(players)
  .where(and(
    eq(players.leagueId, 1),
    isNull(players.teamId),
    sql`(${players.special} ILIKE '%KR%' OR ${players.special} ILIKE '%PR%' OR ${players.special} ILIKE '%RET%')`
  ))
  .limit(8);

for (const r of rows) {
  console.log(`\n${r.name} | pos=${r.position} spc=${r.special}`);
  if (r.scouting) {
    console.log('  keys:', Object.keys(r.scouting).join(', '));
  } else {
    console.log('  no scouting data');
  }
}
process.exit(0);
