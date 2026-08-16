import { describe, expect, it } from 'vitest';

import { MockMailTransport } from '@your-flare-mails/core';
import type { D1Queryable } from '@your-flare-mails/cloudflare';

import { sendDraft } from './outbound-service.js';

describe('sendDraft validation', () => {
  it('rejects empty recipient lists via ValidationError', async () => {
    const transport = new MockMailTransport();
    const db: D1Queryable = {
      prepare(query: string) {
        return {
          bind(..._values: unknown[]) {
            return {
              async first<T = Record<string, unknown>>() {
                if (query.includes('FROM drafts')) {
                  return {
                    id: 'drf_1',
                    mailbox_id: 'mbx_1',
                    thread_id: null,
                    to_json: '[]',
                    cc_json: '[]',
                    bcc_json: '[]',
                    subject: 'Hi',
                    body_text: 'body',
                    body_html: null,
                    in_reply_to_message_id: null,
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-01T00:00:00.000Z',
                  } as T;
                }
                if (query.includes('FROM mailbox_users')) {
                  return { role: 'owner' } as T;
                }
                if (query.includes('FROM mailboxes')) {
                  return {
                    id: 'mbx_1',
                    domain_id: 'dom_1',
                    local_part: 'hello',
                    address: 'hello@example.com',
                    display_name: 'Hello',
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-01T00:00:00.000Z',
                  } as T;
                }
                return null;
              },
              async all<T = Record<string, unknown>>() {
                return { results: [] as T[] };
              },
              async run() {
                return {};
              },
            };
          },
        };
      },
      async batch() {
        return [];
      },
    };

    await expect(
      sendDraft(
        {
          db,
          r2: {
            async put() {
              return {};
            },
          },
          transport,
        },
        { userId: 'user_seed_owner' },
        'drf_1',
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });
});
