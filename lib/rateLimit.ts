/**
 * Per-key in-memory token bucket. Survives within a single warm Lambda
 * instance — across instances each gets its own bucket. Good enough for
 * cost-DoS protection on a user-triggered endpoint; not a replacement for
 * Upstash if precise distributed limits are needed.
 */
type Bucket = { tokens: number; lastRefill: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function pruneIfBloated() {
  if (buckets.size < MAX_BUCKETS) return;
  // Drop fully-refilled idle buckets first — they're equivalent to a fresh one.
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.lastRefill > 6 * 60 * 60 * 1000) buckets.delete(k);
    if (buckets.size < MAX_BUCKETS * 0.8) break;
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function tokenBucket(
  key: string,
  capacity: number,
  refillSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const refillRatePerMs = capacity / (refillSeconds * 1000);
  let b = buckets.get(key);
  if (!b) {
    pruneIfBloated();
    b = { tokens: capacity, lastRefill: now };
    buckets.set(key, b);
  }
  const elapsed = now - b.lastRefill;
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillRatePerMs);
  b.lastRefill = now;
  if (b.tokens < 1) {
    const need = 1 - b.tokens;
    const retryMs = Math.ceil(need / refillRatePerMs);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)) };
  }
  b.tokens -= 1;
  return { ok: true };
}
