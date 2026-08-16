import type { D1Queryable } from './db.js';

/**
 * Simple fixed-window rate limiter backed by D1.
 * Good enough for self-hosted single-deployment; not a global multi-colo guarantee.
 */
export async function consumeRateLimit(
  db: D1Queryable,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
): Promise<{ ok: true; remaining: number } | { ok: false; retryAfterSeconds: number }> {
  const windowStartMs =
    Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000;
  const windowStartIso = new Date(windowStartMs).toISOString();

  const existing = await db
    .prepare(
      `SELECT bucket_key, hit_count, window_start FROM rate_limit_buckets WHERE bucket_key = ?`,
    )
    .bind(bucketKey)
    .first<{ bucket_key: string; hit_count: number; window_start: string }>();

  if (!existing || existing.window_start !== windowStartIso) {
    await db
      .prepare(
        `INSERT INTO rate_limit_buckets (bucket_key, hit_count, window_start)
         VALUES (?, 1, ?)
         ON CONFLICT(bucket_key) DO UPDATE SET hit_count = 1, window_start = excluded.window_start`,
      )
      .bind(bucketKey, windowStartIso)
      .run();
    return { ok: true, remaining: Math.max(0, limit - 1) };
  }

  if (existing.hit_count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStartMs + windowSeconds * 1000 - now.getTime()) / 1000),
    );
    return { ok: false, retryAfterSeconds };
  }

  await db
    .prepare(
      `UPDATE rate_limit_buckets SET hit_count = hit_count + 1 WHERE bucket_key = ?`,
    )
    .bind(bucketKey)
    .run();

  return { ok: true, remaining: Math.max(0, limit - existing.hit_count - 1) };
}

/** @internal exported for tests that want a no-op clock */
export function rateLimitNowIso(): string {
  return new Date().toISOString();
}
