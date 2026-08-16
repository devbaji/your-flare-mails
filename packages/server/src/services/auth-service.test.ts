import { describe, expect, it } from 'vitest';

import { hashPassword } from '@your-flare-mails/core';
import type { D1Queryable } from '@your-flare-mails/cloudflare';

import {
  AuthenticationError,
  loginWithPassword,
  resolveRequestAuth,
} from './auth-service.js';

function authDb(user: {
  id: string;
  email: string;
  password_hash: string | null;
}): D1Queryable {
  const sessions = new Map<
    string,
    {
      id: string;
      user_id: string;
      token_hash: string;
      csrf_token: string;
      expires_at: string;
      created_at: string;
      last_seen_at: string;
      user_agent: string | null;
      ip_hash: string | null;
    }
  >();

  return {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (query.includes('FROM users') && query.includes('lower(email)')) {
                if (String(values[0]).toLowerCase() === user.email.toLowerCase()) {
                  return {
                    id: user.id,
                    email: user.email,
                    display_name: 'Owner',
                    password_hash: user.password_hash,
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-01T00:00:00.000Z',
                  } as T;
                }
                return null;
              }
              if (query.includes('FROM users') && query.includes('WHERE id')) {
                if (String(values[0]) === user.id) {
                  return {
                    id: user.id,
                    email: user.email,
                    display_name: 'Owner',
                    password_hash: user.password_hash,
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-01T00:00:00.000Z',
                  } as T;
                }
                return null;
              }
              if (query.includes('FROM sessions') && query.includes('token_hash')) {
                const row = [...sessions.values()].find(
                  (s) => s.token_hash === String(values[0]),
                );
                return (row ?? null) as T | null;
              }
              return null;
            },
            async run() {
              if (query.includes('INSERT INTO sessions')) {
                const row = {
                  id: String(values[0]),
                  user_id: String(values[1]),
                  token_hash: String(values[2]),
                  csrf_token: String(values[3]),
                  expires_at: String(values[4]),
                  created_at: String(values[5]),
                  last_seen_at: String(values[6]),
                  user_agent: (values[7] as string | null) ?? null,
                  ip_hash: (values[8] as string | null) ?? null,
                };
                sessions.set(row.id, row);
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

describe('loginWithPassword', () => {
  it('creates a session for a valid password', async () => {
    const passwordHash = await hashPassword('owner-dev-password');
    const db = authDb({
      id: 'user_seed_owner',
      email: 'owner@example.com',
      password_hash: passwordHash,
    });

    const result = await loginWithPassword(
      { db },
      { email: 'owner@example.com', password: 'owner-dev-password' },
    );
    expect(result.user.email).toBe('owner@example.com');
    expect(result.sessionToken).toHaveLength(64);
    expect(result.csrfToken).toHaveLength(32);

    const auth = await resolveRequestAuth(
      { db },
      new Request('https://api.example.com/api/mailboxes', {
        headers: { authorization: `Bearer ${result.sessionToken}` },
      }),
    );
    expect(auth.ctx.userId).toBe('user_seed_owner');
    expect(auth.via).toBe('session');
  });

  it('rejects bad passwords', async () => {
    const passwordHash = await hashPassword('owner-dev-password');
    const db = authDb({
      id: 'user_seed_owner',
      email: 'owner@example.com',
      password_hash: passwordHash,
    });
    await expect(
      loginWithPassword(
        { db },
        { email: 'owner@example.com', password: 'nope' },
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
