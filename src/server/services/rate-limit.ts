/**
 * Simple in-memory rate limit stub for auth endpoints.
 * Before adding a real store (Redis/D1), this protects login/register/reset
 * from naive brute force. It is per-key and resets on a sliding window.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 10_000;
const MAX_REQUESTS = 10;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= MAX_REQUESTS;
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
