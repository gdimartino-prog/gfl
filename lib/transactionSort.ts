export type TransactionSortKey =
  | 'timestamp'
  | 'type'
  | 'details'
  | 'fromFull'
  | 'toFull'
  | 'weekBack'
  | 'fee'
  | 'status';

export type SortDir = 'asc' | 'desc';

export interface SortableTransactionRow {
  id?: string | number;
  dateIso?: string;
  timestamp?: string;
  type?: string;
  details?: string;
  fromFull?: string;
  toFull?: string;
  weekBack?: string | number;
  fee?: string | number;
  status?: string;
}

export const DEFAULT_SORT_DIR: Record<TransactionSortKey, SortDir> = {
  timestamp: 'desc',
  type: 'asc',
  details: 'asc',
  fromFull: 'asc',
  toFull: 'asc',
  weekBack: 'asc',
  fee: 'desc',
  status: 'asc',
};

function parseTimestampMs(row: SortableTransactionRow): number | null {
  if (row.dateIso && row.dateIso.trim() !== '') {
    const ms = Date.parse(row.dateIso);
    if (Number.isFinite(ms)) return ms;
  }
  if (row.timestamp && row.timestamp.trim() !== '') {
    const ms = Date.parse(row.timestamp);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

function parseNumericOrNull(val: string | number | undefined, positiveOnly = false): number | null {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (positiveOnly && n <= 0) return null;
  return n;
}

function compareNullableNumbers(
  av: number | null,
  bv: number | null,
  dir: SortDir,
): number | null {
  if (av === null && bv === null) return null;
  if (av === null) return 1;
  if (bv === null) return -1;
  if (av === bv) return null;
  const cmp = av - bv;
  return dir === 'asc' ? cmp : -cmp;
}

function comparePrimary(
  a: SortableTransactionRow,
  b: SortableTransactionRow,
  key: TransactionSortKey,
  dir: SortDir,
): number {
  if (key === 'timestamp') {
    return compareNullableNumbers(parseTimestampMs(a), parseTimestampMs(b), dir) ?? 0;
  }
  if (key === 'weekBack') {
    return compareNullableNumbers(parseNumericOrNull(a.weekBack), parseNumericOrNull(b.weekBack), dir) ?? 0;
  }
  if (key === 'fee') {
    return compareNullableNumbers(parseNumericOrNull(a.fee, true), parseNumericOrNull(b.fee, true), dir) ?? 0;
  }

  const av = String(a[key] ?? '').trim();
  const bv = String(b[key] ?? '').trim();
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base', numeric: true });
  return cmp === 0 ? 0 : dir === 'asc' ? cmp : -cmp;
}

function compareTieBreaker(a: SortableTransactionRow, b: SortableTransactionRow): number {
  const tsCmp = compareNullableNumbers(parseTimestampMs(a), parseTimestampMs(b), 'desc');
  if (tsCmp !== null) return tsCmp;

  const aId = Number(a.id ?? 0);
  const bId = Number(b.id ?? 0);
  if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) {
    return bId - aId;
  }
  return 0;
}

/**
 * Returns a new array of transactions sorted by `key` and `dir`.
 * Blank / missing (`—`) values always sort last regardless of direction.
 */
export function sortTransactions<T extends SortableTransactionRow>(
  rows: readonly T[],
  key: TransactionSortKey,
  dir: SortDir,
): T[] {
  return [...rows].sort((a, b) => {
    const primary = comparePrimary(a, b, key, dir);
    if (primary !== 0) return primary;
    return compareTieBreaker(a, b);
  });
}
