/**
 * Minimal in-memory sliding-window rate limiter (per-key).
 *
 * Good enough for the single Render instance this app runs on: it caps abuse
 * bursts (e.g. spamming email through the user's Gmail) without needing Redis.
 * State is per-process and resets on restart — acceptable for abuse throttling,
 * not for billing/quotas.
 */
const hits = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);

  if (recent.length >= max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    hits.set(key, recent);
    return { ok: false, retryAfterSeconds };
  }

  recent.push(now);
  hits.set(key, recent);

  // opportunistic cleanup so the map doesn't grow unbounded
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }

  return { ok: true, retryAfterSeconds: 0 };
}
