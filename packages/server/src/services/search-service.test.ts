import { describe, expect, it } from 'vitest';

import { buildFtsMatchQuery } from '@your-flare-mails/cloudflare';

import { searchMessages } from './search-service.js';

describe('searchMessages auth gate', () => {
  it('requires mailbox membership before querying', async () => {
    await expect(
      searchMessages(
        {
          db: {
            prepare() {
              return {
                bind() {
                  return {
                    async first() {
                      return null;
                    },
                    async all() {
                      return { results: [] };
                    },
                    async run() {
                      return {};
                    },
                  };
                },
              };
            },
            batch() {
              throw new Error('unused');
            },
          },
        },
        { userId: 'user_x' },
        { mailboxId: 'mbx_missing', q: 'invoice' },
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('buildFtsMatchQuery (re-export sanity)', () => {
  it('is available for search service consumers', () => {
    expect(buildFtsMatchQuery('hello world')).toContain('hello');
  });
});
