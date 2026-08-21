import { db } from '../lib/db';
import { players, transactions } from '../schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

const leagueId = 1;

const irTxns = await db.select({ fromTeam: transactions.fromTeam, description: transactions.description, date: transactions.date })
  .from(transactions)
  .where(and(eq(transactions.leagueId, leagueId), inArray(transactions.type, ['IR', 'IR MOVE'])))
  .orderBy(transactions.date);

const removeTxns = await db.select({ description: transactions.description, date: transactions.date })
  .from(transactions)
  .where(and(eq(transactions.leagueId, leagueId), inArray(transactions.type, ['DROP', 'WAIVE', 'ADD'])))
  .orderBy(transactions.date);

function parseName(desc: string | null): string | null {
  const m = (desc || '').match(/Placed on IR:\s*(?:[A-Z\-\/]+ - )?(.+)/i);
  return m ? m[1].trim().toLowerCase() : null;
}

const stillOnIR: string[] = [];
for (const t of irTxns) {
  const name = parseName(t.description);
  if (!name) continue;
  const removed = removeTxns.some(r =>
    new Date(r.date!) > new Date(t.date!) &&
    (r.description || '').toLowerCase().includes(name)
  );
  if (!removed) stillOnIR.push(name);
}

// Clear all stale IR flags first
await db.update(players)
  .set({ isIR: false, touch_id: 'ir-restore' })
  .where(and(eq(players.leagueId, leagueId), sql`${players.isIR} = true`));

console.log(`Players still on IR per transactions: ${stillOnIR.length}`);
for (const name of stillOnIR) {
  const result = await db.update(players)
    .set({ isIR: true, touch_id: 'ir-restore' })
    .where(and(eq(players.leagueId, leagueId), sql`lower(${players.name}) = ${name}`));
  const count = (result as { rowCount?: number }).rowCount ?? 0;
  console.log(`  ${count > 0 ? '✓' : '✗ NOT FOUND'} ${name}`);
}

console.log('\nDone.');
process.exit(0);
