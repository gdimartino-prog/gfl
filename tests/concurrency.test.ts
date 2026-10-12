import test from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency } from '../lib/concurrency';

test('mapWithConcurrency preserves input order', async () => {
  const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 10);
  assert.deepEqual(out, [10, 20, 30, 40, 50]);
});

test('mapWithConcurrency returns empty array for empty input', async () => {
  let called = false;
  const out = await mapWithConcurrency([], 4, async () => {
    called = true;
    return 1;
  });
  assert.deepEqual(out, []);
  assert.equal(called, false);
});

test('mapWithConcurrency never exceeds the limit', async () => {
  let inFlight = 0;
  let peak = 0;
  const items = Array.from({ length: 20 }, (_, i) => i);
  await mapWithConcurrency(items, 3, async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return null;
  });
  assert.ok(peak <= 3, `peak concurrency ${peak} exceeded limit 3`);
  assert.ok(peak > 1, `expected some concurrency, peak was ${peak}`);
});

test('mapWithConcurrency passes the index to the mapper', async () => {
  const out = await mapWithConcurrency(['a', 'b', 'c'], 2, async (_item, i) => i);
  assert.deepEqual(out, [0, 1, 2]);
});

test('mapWithConcurrency clamps non-positive limit to 1', async () => {
  const out = await mapWithConcurrency([1, 2, 3], 0, async (n) => n + 1);
  assert.deepEqual(out, [2, 3, 4]);
});
