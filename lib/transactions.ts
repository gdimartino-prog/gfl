
import { db } from './db';
import { transactions, rules } from '@/schema';
import { desc, eq, and, isNull } from 'drizzle-orm';

export async function logTransaction(tx: {
  type: string;
  details?: string;
  fromTeam?: string;
  toTeam?: string;
  coach?: string;
  weekBack?: string | number;
  status?: string;
  touch_id?: string;
  leagueId?: number;
}) {
  const leagueId = tx.leagueId ?? 1;
  let fee = 0;

  // Look up fa_pickup_fee rule for ADD transactions
  if (tx.type === 'ADD') {
    const ruleRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'fa_pickup_fee'), isNull(rules.year)))
      .limit(1);
    fee = ruleRow[0] ? parseInt(ruleRow[0].value) || 0 : 0;
  }

  await db.insert(transactions).values({
    date: new Date(),
    leagueId,
    type: tx.type,
    description: tx.details || null,
    fromTeam: tx.fromTeam || null,
    toTeam: tx.toTeam || null,
    owner: tx.coach || null,
    status: 'Pending',
    weekBack: tx.weekBack ? (parseInt(String(tx.weekBack)) || null) : null,
    fee,
    touch_id: tx.touch_id || tx.coach || 'transaction',
  });
}

export async function getTransactions(leagueId: number = 1) {
  return db.select().from(transactions)
    .where(eq(transactions.leagueId, leagueId))
    .orderBy(desc(transactions.date));
}

export async function updateTransactionStatus(id: number, status: string) {
  await db.update(transactions)
    .set({ status, touch_id: 'commissioner' })
    .where(eq(transactions.id, id));
}
