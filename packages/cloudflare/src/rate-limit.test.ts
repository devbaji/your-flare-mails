import { describe, expect, it } from 'vitest';

import type { D1Queryable } from './db.js';
import { consumeRateLimit } from './rate-limit.js';

function memoryDb(): D1Queryable & { store: Map<string, { hit_count: number; window_start: string }> } {
  const store = new Map<string, { hit_count: number; window_start: string }>();
  return {
    store,
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (query.includes('FROM rate_limit_buckets')) {
                const key = String(values[0]);
                const row = store.get(key);
                return (row
                  ? { bucket_key: key, hit_count: row.hit_count, window_start: row.window_start }
                  : null) as T | null;
              }
              return null;
            },
            async run() {
              if (query.includes('INSERT INTO rate_limit_buckets')) {
                const key = String(values[0]);
                const windowStart = String(values[1]);
                store.set(key, { hit_count: 1, window_start: windowStart });
              } else if (query.includes('SET hit_count = hit_count + 1')) {
                const key = String(values[0]);
                const row = store.get(key);
                if (row) row.hit_count += 1;
              }
              return {};
            },
            async all<T>() {
              return { results: [] as T[] };
            },
          };
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

describe('consumeRateLimit', () => {
  it('allows up to the limit then blocks', async () => {
    const db = memoryDb();
    const now = new Date('2026-08-17T00:00:00.000Z');
    expect((await consumeRateLimit(db, 'login:ip:1', 2, 60, now)).ok).toBe(true);
    expect((await consumeRateLimit(db, 'login:ip:1', 2, 60, now)).ok).toBe(true);
    const blocked = await consumeRateLimit(db, 'login:ip:1', 2, 60, now);
    expect(blocked.ok).toBe(false);
  });
});
