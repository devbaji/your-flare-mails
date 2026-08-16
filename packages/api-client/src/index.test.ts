import { describe, expect, it, vi } from 'vitest';

import { MailApiError, createMailApiClient } from './index.js';

describe('createMailApiClient', () => {
  it('sends the temporary user header', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ mailboxes: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createMailApiClient({
      baseUrl: 'http://127.0.0.1:8787',
      getUserId: () => 'user_seed_owner',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.listMailboxes();
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [RequestInfo, RequestInit?];
    const headers = new Headers(call[1]?.headers);
    expect(headers.get('x-yfm-user-id')).toBe('user_seed_owner');
  });

  it('throws MailApiError on failure', async () => {
    const client = createMailApiClient({
      baseUrl: 'http://127.0.0.1:8787',
      getUserId: () => 'user_seed_owner',
      fetch: (async () =>
        new Response(JSON.stringify({ message: 'nope' }), { status: 403 })) as typeof fetch,
    });

    await expect(client.listMailboxes()).rejects.toBeInstanceOf(MailApiError);
  });
});
