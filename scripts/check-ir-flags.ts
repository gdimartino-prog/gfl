import { db } from '../lib/db';
import { players, transactions } from '../schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

const leagueId = 1;

const irTxns = await db.select({ fromTeam: transactions.fromTeam, description: transactions.description, date: transactions.date })
  .from(transactions)
  .where(and(eq(transactions.leagueId, leagueId), inArray(transactions.type, ['IR', 'IR MOVE'])))
  .orderBy(transactions.date);

const removeTxns = await db.select({ type: transactions.type, description: transactions.description, date: transactions.date })
  .from(transactions)
  .where(and(eq(transactions.leagueId, leagueId), inArray(transactions.type, ['DROP', 'WAIVE', 'ADD'])))
  .orderBy(transactions.date);

function parseName(desc: string | null): string | null {
  const m = (desc || '').match(/Placed on IR:\s*(?:[A-Z\-\/]+ - )?(.+)/i);
  return m ? m[1].trim().toLowerCase() : null;
}

type IREntry = { team: string | null; name: string; description: string | null; removed: boolean };
const activeIR: IREntry[] = [];
for (const t of irTxns) {
  const name = parseName(t.description);
  if (!name) continue;
  const removed = removeTxns.some(r =>
    new Date(r.date!) > new Date(t.date!) &&
    (r.description || '').toLowerCase().includes(name)
  );
  activeIR.push({ team: t.fromTeam, name, description: t.description, removed });
}

console.log('IR transaction log:');
for (const p of activeIR) {
  console.log(`  [${p.team}] ${p.description} | ${p.removed ? 'REMOVED from IR' : 'STILL ON IR'}`);
}

const stillOnIR = activeIR.filter(x => !x.removed);
console.log(`\nPlayers still on IR per transactions: ${stillOnIR.length}`);
console.log('\nCross-checking isIR flag in DB:');

for (const p of stillOnIR) {
  const rows = await db.select({ id: players.id, name: players.name, isIR: players.isIR, teamId: players.teamId })
    .from(players)
    .where(and(
      eq(players.leagueId, leagueId),
      sql`lower(${players.name}) LIKE lower('%' || ${p.name} || '%')`,
    ))
    .limit(2);
  for (const pl of rows) {
    const flagOk = pl.isIR === true;
    const onTeam = pl.teamId !== null;
    const marker = onTeam && !flagOk ? ' <<< isIR FLAG NOT SET' : '';
    console.log(`  [${p.team}] ${(pl.name ?? '').padEnd(30)} isIR=${pl.isIR} teamId=${pl.teamId ?? 'null (FA)'}${marker}`);
  }
}
process.exit(0);
