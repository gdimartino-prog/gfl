import test from 'node:test';
import assert from 'node:assert/strict';
import { sortTransactions, DEFAULT_SORT_DIR, type SortableTransactionRow } from '../lib/transactionSort';

test('sortTransactions does not mutate input array', () => {
  const rows: SortableTransactionRow[] = [
    { id: 1, dateIso: '2026-11-20T12:00:00.000Z', type: 'ADD' },
    { id: 2, dateIso: '2026-11-22T12:00:00.000Z', type: 'WAIVE' },
  ];
  const snapshot = rows.map(r => r.id);
  const sorted = sortTransactions(rows, 'timestamp', 'asc');
  assert.deepEqual(rows.map(r => r.id), snapshot);
  assert.deepEqual(sorted.map(r => r.id), [1, 2]);
});

test('timestamp sorting handles dateIso, locale fallback, and missing timestamps', () => {
  const rows: SortableTransactionRow[] = [
    { id: 1, timestamp: '11/20/2026, 7:50:50 AM' },
    { id: 2, dateIso: '', timestamp: '' },
    { id: 3, dateIso: '2026-11-22T19:02:35.000Z', timestamp: '11/22/2026, 2:02:35 PM' },
    { id: 4, dateIso: '2026-11-21T01:58:07.000Z', timestamp: '11/20/2026, 8:58:07 PM' },
  ];

  assert.deepEqual(
    sortTransactions(rows, 'timestamp', 'desc').map(r => r.id),
    [3, 4, 1, 2],
  );
  assert.deepEqual(
    sortTransactions(rows, 'timestamp', 'asc').map(r => r.id),
    [1, 4, 3, 2],
  );
});

test('weekBack sorts numerically with empty values always last', () => {
  const rows: SortableTransactionRow[] = [
    { id: 1, weekBack: '12', dateIso: '2026-11-20T10:00:00.000Z' },
    { id: 2, weekBack: '', dateIso: '2026-11-22T10:00:00.000Z' },
    { id: 3, weekBack: '7', dateIso: '2026-11-19T10:00:00.000Z' },
    { id: 4, weekBack: '15', dateIso: '2026-11-21T10:00:00.000Z' },
    { id: 5, dateIso: '2026-11-18T10:00:00.000Z' },
  ];

  assert.deepEqual(
    sortTransactions(rows, 'weekBack', 'asc').map(r => r.id),
    [3, 1, 4, 2, 5],
  );
  assert.deepEqual(
    sortTransactions(rows, 'weekBack', 'desc').map(r => r.id),
    [4, 1, 3, 2, 5],
  );
});

test('fee sorts numerically with 0/blank values always last', () => {
  const rows: SortableTransactionRow[] = [
    { id: 1, fee: 10 },
    { id: 2, fee: 0, dateIso: '2026-11-21T10:00:00.000Z' },
    { id: 3, fee: 25 },
    { id: 4, fee: '5' },
    { id: 5, fee: '', dateIso: '2026-11-20T10:00:00.000Z' },
  ];

  assert.deepEqual(
    sortTransactions(rows, 'fee', 'desc').map(r => r.id),
    [3, 1, 4, 2, 5],
  );
  assert.deepEqual(
    sortTransactions(rows, 'fee', 'asc').map(r => r.id),
    [4, 1, 3, 2, 5],
  );
});

test('text columns sort case-insensitively with blanks last and tie-break by newest timestamp', () => {
  const rows: SortableTransactionRow[] = [
    { id: 10, type: 'TRADE', fromFull: 'Tampa', toFull: 'Kigali', status: 'Pending', weekBack: '15', dateIso: '2026-11-20T12:00:00.000Z' },
    { id: 11, type: 'add', fromFull: 'FA', toFull: 'Vico', status: 'Done', weekBack: '15', dateIso: '2026-11-22T12:00:00.000Z' },
    { id: 12, type: 'INJURY PICKUP', fromFull: '', toFull: 'Amalfi', status: '', weekBack: '15', dateIso: '2026-11-21T12:00:00.000Z' },
  ];

  assert.deepEqual(sortTransactions(rows, 'type', 'asc').map(r => r.id), [11, 12, 10]);
  assert.deepEqual(sortTransactions(rows, 'fromFull', 'asc').map(r => r.id), [11, 10, 12]);
  assert.deepEqual(sortTransactions(rows, 'fromFull', 'desc').map(r => r.id), [10, 11, 12]);
  assert.deepEqual(sortTransactions(rows, 'status', 'asc').map(r => r.id), [11, 10, 12]);

  // Same weekBack (15) tie-breaks newest timestamp first in both asc and desc
  assert.deepEqual(sortTransactions(rows, 'weekBack', 'asc').map(r => r.id), [11, 12, 10]);
  assert.deepEqual(sortTransactions(rows, 'weekBack', 'desc').map(r => r.id), [11, 12, 10]);

  assert.equal(DEFAULT_SORT_DIR.timestamp, 'desc');
  assert.equal(DEFAULT_SORT_DIR.fee, 'desc');
  assert.equal(DEFAULT_SORT_DIR.weekBack, 'asc');
});
