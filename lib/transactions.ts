
import { db } from './db';
import { transactions } from '@/schema';
import { desc, eq } from 'drizzle-orm';

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
  await db.insert(transactions).values({
    date: new Date(),
    leagueId: tx.leagueId ?? 1,
    type: tx.type,
    description: tx.details || null,
    fromTeam: tx.fromTeam || null,
    toTeam: tx.toTeam || null,
    owner: tx.coach || null,
    status: 'Pending',
    weekBack: tx.weekBack ? (parseInt(String(tx.weekBack)) || null) : null,
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
