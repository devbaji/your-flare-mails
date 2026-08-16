/**
 * Per-mailbox Durable Object using the WebSocket Hibernation API.
 *
 * One instance per mailbox (`idFromName(mailboxId)`). REST stays on the Worker;
 * this object only coordinates connected clients and a short event buffer for poll.
 */

import type { MailboxRealtimeEvent } from '@your-flare-mails/core';

import {
  appendRealtimeEvent,
  eventsSince,
  parseRealtimeEvent,
  type BufferedRealtimeEvent,
  type WebSocketAttachment,
} from './events.js';

type DurableObjectStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
};

type DurableObjectStateLike = {
  storage: DurableObjectStorage;
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
};

type HibernationWebSocket = WebSocket & {
  serializeAttachment(attachment: unknown): void;
  deserializeAttachment(): unknown;
};

/**
 * Exported Durable Object class for `workers/api` wrangler binding `MAILBOX_REALTIME`.
 */
export class MailboxRealtime {
  constructor(
    private readonly ctx: DurableObjectStateLike,
    _env: unknown,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgrade = request.headers.get('Upgrade');
    if (upgrade?.toLowerCase() === 'websocket') {
      return this.acceptClient(request);
    }

    if (request.method === 'POST' && (url.pathname === '/notify' || url.pathname.endsWith('/notify'))) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid_json' }, { status: 400 });
      }
      const event = parseRealtimeEvent(body);
      if (!event) {
        return Response.json({ error: 'invalid_event' }, { status: 400 });
      }
      await this.broadcastEvent(event);
      return Response.json({ ok: true });
    }

    if (request.method === 'GET' && (url.pathname === '/poll' || url.pathname.endsWith('/poll'))) {
      const since = Number.parseInt(url.searchParams.get('since') ?? '0', 10);
      const seq = (await this.ctx.storage.get<number>('seq')) ?? 0;
      const buffered =
        (await this.ctx.storage.get<BufferedRealtimeEvent[]>('events')) ?? [];
      return Response.json({
        seq,
        events: eventsSince(buffered, Number.isFinite(since) ? since : 0),
      });
    }

    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text =
      typeof message === 'string' ? message : new TextDecoder().decode(message);
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // plain ping
    }

    if (
      text === 'ping' ||
      (parsed &&
        typeof parsed === 'object' &&
        (parsed as { type?: unknown }).type === 'ping')
    ) {
      const payload = JSON.stringify({
        type: 'ping',
        at: new Date().toISOString(),
      } satisfies MailboxRealtimeEvent);
      ws.send(payload);
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, 'error');
    } catch {
      // ignore
    }
  }

  private async acceptClient(request: Request): Promise<Response> {
    const Pair = (
      globalThis as unknown as {
        WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };
      }
    ).WebSocketPair;
    const pair = new Pair();
    const client = pair[0];
    const server = pair[1] as HibernationWebSocket;

    const attachment: WebSocketAttachment = {
      userId: request.headers.get('x-yfm-ws-user-id')?.trim() || 'anonymous',
      connectedAt:
        request.headers.get('x-yfm-ws-connected-at')?.trim() ||
        new Date().toISOString(),
    };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);

    const seq = (await this.ctx.storage.get<number>('seq')) ?? 0;
    // Non-schema hello so clients can sync the poll cursor without a false mailbox event.
    server.send(
      JSON.stringify({
        type: 'hello',
        seq,
        at: new Date().toISOString(),
      }),
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  }

  private async broadcastEvent(event: MailboxRealtimeEvent): Promise<void> {
    const prevSeq = (await this.ctx.storage.get<number>('seq')) ?? 0;
    const prevEvents =
      (await this.ctx.storage.get<BufferedRealtimeEvent[]>('events')) ?? [];
    const { seq, events } = appendRealtimeEvent(prevEvents, prevSeq, event);
    await this.ctx.storage.put({ seq, events });

    const payload = JSON.stringify({ seq, event });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        // drop broken sockets; close handler cleans up
      }
    }
  }
}
