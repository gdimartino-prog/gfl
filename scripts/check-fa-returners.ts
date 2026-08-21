import { db } from '../lib/db';
import { players } from '../schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

const rows = await db
  .select({ position: players.position, count: sql<number>`count(*)` })
  .from(players)
  .where(and(
    eq(players.leagueId, 1),
    isNull(players.teamId),
    sql`(${players.position} ILIKE '%KR%' OR ${players.position} ILIKE '%PR%' OR ${players.position} ILIKE '%RET%')`,
  ))
  .groupBy(players.position);

console.log('Free agents with KR/PR/RET in position:');
for (const r of rows) console.log(`  ${r.position}: ${r.count}`);
console.log(`Total distinct positions: ${rows.length}`);
process.exit(0);
