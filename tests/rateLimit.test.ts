import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenBucket } from '../lib/rateLimit';

test('tokenBucket allows up to capacity, then rejects', () => {
  const key = `t-${Math.random()}`;
  assert.equal(tokenBucket(key, 3, 1000).ok, true);
  assert.equal(tokenBucket(key, 3, 1000).ok, true);
  assert.equal(tokenBucket(key, 3, 1000).ok, true);
  const denied = tokenBucket(key, 3, 1000);
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.ok(denied.retryAfterSec >= 1);
});

test('tokenBucket keys are independent', () => {
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  tokenBucket(a, 1, 1000);
  assert.equal(tokenBucket(a, 1, 1000).ok, false);
  assert.equal(tokenBucket(b, 1, 1000).ok, true);
});

test('tokenBucket refills over time', async () => {
  const key = `refill-${Math.random()}`;
  assert.equal(tokenBucket(key, 1, 0.05).ok, true);
  assert.equal(tokenBucket(key, 1, 0.05).ok, false);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(tokenBucket(key, 1, 0.05).ok, true);
});
