import { db } from '../lib/db';
import { players } from '../schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

// Sample a few free-agent returners to see how offense/defense/special/position
// fields are populated. The free-agents page filter checks all four — bug
// candidate: if "KR" is only in `special` but not in `position`, the
// availableGroups filter (which uses short-circuit OR on the four fields)
// might skip it.
const rows = await db
  .select({
    name: players.name,
    position: players.position,
    offense: players.offense,
    defense: players.defense,
    special: players.special,
  })
  .from(players)
  .where(and(
    eq(players.leagueId, 1),
    isNull(players.teamId),
    sql`(${players.position} ILIKE '%KR%' OR ${players.position} ILIKE '%PR%' OR ${players.position} ILIKE '%RET%' OR ${players.special} ILIKE '%KR%' OR ${players.special} ILIKE '%PR%' OR ${players.special} ILIKE '%RET%')`,
  ))
  .limit(15);

console.log('Sample FA returners — position/offense/defense/special fields:');
for (const r of rows) {
  console.log(`  ${r.name?.padEnd(30)} pos=${(r.position ?? '').padEnd(10)} off=${(r.offense ?? '').padEnd(10)} def=${(r.defense ?? '').padEnd(10)} spc=${r.special ?? ''}`);
}
process.exit(0);
