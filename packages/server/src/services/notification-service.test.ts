import { describe, expect, it } from 'vitest';

import { MockPushTransport, type D1Queryable } from '@your-flare-mails/cloudflare';

import { notifyMailboxDevices, registerDevice } from './notification-service.js';

function memoryDb(): D1Queryable & {
  devices: Map<string, Record<string, unknown>>;
  subs: Set<string>;
} {
  const devices = new Map<string, Record<string, unknown>>();
  const subs = new Set<string>();
  return {
    devices,
    subs,
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (query.includes('FROM devices') && query.includes('push_endpoint')) {
                for (const row of devices.values()) {
                  if (
                    row.user_id === values[0] &&
                    row.platform === values[1] &&
                    row.push_endpoint === values[2]
                  ) {
                    return row as T;
                  }
                }
                return null;
              }
              if (query.includes('FROM mailbox_users')) {
                return { role: 'owner' } as T;
              }
              return null;
            },
            async run() {
              if (query.includes('INSERT INTO devices')) {
                devices.set(String(values[0]), {
                  id: values[0],
                  user_id: values[1],
                  platform: values[2],
                  push_endpoint: values[3],
                  push_keys_json: values[4],
                  created_at: values[5],
                  updated_at: values[6],
                });
              }
              if (query.includes('INSERT INTO notification_subscriptions')) {
                subs.add(`${values[1]}:${values[2]}`);
              }
              return {};
            },
            async all<T>() {
              if (query.includes('notification_subscriptions')) {
                const mailboxId = String(values[0]);
                const results = [...devices.values()].filter((row) =>
                  subs.has(`${row.id}:${mailboxId}`),
                );
                return { results: results as T[] };
              }
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

describe('notification service', () => {
  it('registers a device and fans out pushes', async () => {
    const db = memoryDb();
    const device = await registerDevice(
      { db },
      { userId: 'user_seed_owner' },
      {
        platform: 'ios',
        pushEndpoint: 'abc123token',
        mailboxId: 'mbx_seed_hello',
      },
    );
    expect(device.platform).toBe('ios');

    const push = new MockPushTransport();
    const result = await notifyMailboxDevices(
      { db, push },
      'mbx_seed_hello',
      { title: 'New mail', body: 'You have mail' },
    );
    expect(result.attempted).toBe(1);
    expect(result.delivered).toBe(1);
    expect(push.sent[0]?.endpoint).toBe('abc123token');
  });
});
