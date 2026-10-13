
import { db } from './db';
import { transactions, rules } from '@/schema';
import { desc, eq, and, isNull } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

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
  season?: number;
  pickIds?: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}, executor: any = db) {
  const leagueId = tx.leagueId ?? 1;
  let fee = 0;

  // Look up fa_pickup_fee rule for ADD transactions
  if (tx.type === 'ADD') {
    const ruleRow = await executor.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'fa_pickup_fee'), isNull(rules.year)))
      .limit(1);
    fee = ruleRow[0] ? parseInt(ruleRow[0].value) || 0 : 0;
  }

  await executor.insert(transactions).values({
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
    season: tx.season ?? null,
    pickIds: tx.pickIds?.length ? tx.pickIds : null,
    touch_id: tx.touch_id || tx.coach || 'transaction',
  });
}

const _getTransactions = unstable_cache(
  async (leagueId: number) => {
    return db.select({
      id: transactions.id,
      date: transactions.date,
      type: transactions.type,
      description: transactions.description,
      fromTeam: transactions.fromTeam,
      toTeam: transactions.toTeam,
      owner: transactions.owner,
      status: transactions.status,
      weekBack: transactions.weekBack,
      fee: transactions.fee,
      season: transactions.season,
      pickIds: transactions.pickIds,
      conditionalDetails: transactions.conditionalDetails,
    }).from(transactions)
      .where(eq(transactions.leagueId, leagueId))
      .orderBy(desc(transactions.date))
      .limit(200);
  },
  ['transactions'],
  { revalidate: 60, tags: ['transactions'] }
);

export async function getTransactions(leagueId: number) {
  return _getTransactions(leagueId);
}

export async function updateTransactionStatus(id: number, status: string, leagueId: number, actor: string = 'commissioner') {
  await db.update(transactions)
    .set({ status, touch_id: actor })
    .where(and(eq(transactions.id, id), eq(transactions.leagueId, leagueId)));
}

export async function updateTransactionConditional(id: number, conditionalDetails: string | null, leagueId: number, actor: string = 'commissioner') {
  await db.update(transactions)
    .set({ conditionalDetails, touch_id: actor })
    .where(and(eq(transactions.id, id), eq(transactions.leagueId, leagueId)));
}

export async function updateTransactionDetails(
  id: number,
  fields: { details?: string; weekBack?: number | null; type?: string; fromTeam?: string | null; toTeam?: string | null; fee?: number | null },
  leagueId: number,
  actor: string = 'commissioner',
) {
  const set: { description?: string; weekBack?: number | null; type?: string; fromTeam?: string | null; toTeam?: string | null; fee?: number | null; touch_id: string } = { touch_id: actor };
  if (fields.details !== undefined) set.description = fields.details;
  if (fields.weekBack !== undefined) set.weekBack = fields.weekBack;
  if (fields.type !== undefined) set.type = fields.type;
  if (fields.fromTeam !== undefined) set.fromTeam = fields.fromTeam;
  if (fields.toTeam !== undefined) set.toTeam = fields.toTeam;
  if (fields.fee !== undefined) set.fee = fields.fee;
  await db.update(transactions)
    .set(set)
    .where(and(eq(transactions.id, id), eq(transactions.leagueId, leagueId)));
}
