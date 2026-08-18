/**
 * In-memory rate limits for event WiFi (many students, one public IP).
 * Not shared across serverless isolates — still good burst protection.
 */

type Bucket = number[];

type GlobalBuckets = {
  __gsaRateByIp?: Map<string, Bucket>;
  __gsaRateByClient?: Map<string, Bucket>;
};

function maps() {
  const g = globalThis as typeof globalThis & GlobalBuckets;
  if (!g.__gsaRateByIp) g.__gsaRateByIp = new Map();
  if (!g.__gsaRateByClient) g.__gsaRateByClient = new Map();
  return { byIp: g.__gsaRateByIp, byClient: g.__gsaRateByClient };
}

function prune(timestamps: number[], now: number, windowMs: number) {
  const cutoff = now - windowMs;
  let i = 0;
  while (i < timestamps.length && timestamps[i]! < cutoff) i += 1;
  if (i > 0) timestamps.splice(0, i);
}

function allow(
  map: Map<string, Bucket>,
  key: string,
  now: number,
  windowMs: number,
  max: number,
): boolean {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = [];
    map.set(key, bucket);
  }
  prune(bucket, now, windowMs);
  if (bucket.length >= max) return false;
  bucket.push(now);
  return true;
}

/** Shared school WiFi: many phones, one NAT IP. */
const IP_WINDOW_MS = 10_000;
const IP_MAX = 80; // ~8 students/sec sustained on one IP

/** One device / browser tab spam. */
const CLIENT_WINDOW_MS = 8_000;
const CLIENT_MAX = 3;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export function checkSubmitRateLimit(opts: {
  ip: string;
  clientId?: string | null;
}): RateLimitResult {
  const now = Date.now();
  const { byIp, byClient } = maps();

  const clientKey =
    typeof opts.clientId === "string" && opts.clientId.trim().length >= 8
      ? opts.clientId.trim().slice(0, 80)
      : null;

  if (clientKey) {
    if (!allow(byClient, clientKey, now, CLIENT_WINDOW_MS, CLIENT_MAX)) {
      return { ok: false, retryAfterSec: 3 };
    }
  }

  if (!allow(byIp, opts.ip || "unknown", now, IP_WINDOW_MS, IP_MAX)) {
    return { ok: false, retryAfterSec: 2 };
  }

  return { ok: true };
}
