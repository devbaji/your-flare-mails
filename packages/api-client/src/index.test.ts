import { describe, expect, it, vi } from 'vitest';

import { MailApiError, createMailApiClient } from './index.js';

describe('createMailApiClient', () => {
  it('sends Bearer session + CSRF on mutating requests', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ mailboxes: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createMailApiClient({
      baseUrl: 'http://127.0.0.1:8787',
      getSessionToken: () => 'session-token',
      getCsrfToken: () => 'csrf-token',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.listMailboxes();
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [RequestInfo, RequestInit?];
    const headers = new Headers(call[1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer session-token');
    expect(call[1]?.credentials).toBe('include');
  });

  it('posts folder actions with CSRF', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ thread: { id: 'thr_1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createMailApiClient({
      baseUrl: 'http://127.0.0.1:8787',
      getSessionToken: () => 'session-token',
      getCsrfToken: () => 'csrf-token',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.archiveThread('thr_1');
    await client.trashThread('thr_1');
    await client.moveThreadToInbox('thr_1');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const paths = fetchMock.mock.calls.map((c) => {
      const [urlArg, init] = c as unknown as [
        RequestInfo | URL,
        RequestInit | undefined,
      ];
      return {
        url: String(urlArg),
        method: init?.method,
        csrf: new Headers(init?.headers).get('x-yfm-csrf'),
      };
    });
    expect(paths[0]?.url).toContain('/api/threads/thr_1/archive');
    expect(paths[1]?.url).toContain('/api/threads/thr_1/trash');
    expect(paths[2]?.url).toContain('/api/threads/thr_1/inbox');
    expect(paths.every((p) => p.method === 'POST' && p.csrf === 'csrf-token')).toBe(
      true,
    );
  });

  it('throws MailApiError on failure', async () => {
    const client = createMailApiClient({
      baseUrl: 'http://127.0.0.1:8787',
      getSessionToken: () => 'session-token',
      fetch: (async () =>
        new Response(JSON.stringify({ message: 'nope' }), { status: 403 })) as typeof fetch,
    });

    await expect(client.listMailboxes()).rejects.toBeInstanceOf(MailApiError);
  });
});
