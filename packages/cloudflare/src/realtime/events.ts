import {
  MailboxRealtimeEventSchema,
  type MailboxRealtimeEvent,
} from '@your-flare-mails/core';

export const REALTIME_MAX_BUFFERED_EVENTS = 64;

export type BufferedRealtimeEvent = {
  seq: number;
  event: MailboxRealtimeEvent;
};

export type WebSocketAttachment = {
  userId: string;
  connectedAt: string;
};

/**
 * Append an event to the ring buffer and bump the sequence cursor.
 * Pure helper so Durable Object storage logic stays testable.
 */
export function appendRealtimeEvent(
  existing: BufferedRealtimeEvent[],
  nextSeq: number,
  event: MailboxRealtimeEvent,
  max = REALTIME_MAX_BUFFERED_EVENTS,
): { seq: number; events: BufferedRealtimeEvent[] } {
  const seq = nextSeq + 1;
  const events = [...existing, { seq, event }];
  while (events.length > max) {
    events.shift();
  }
  return { seq, events };
}

export function eventsSince(
  events: BufferedRealtimeEvent[],
  since: number,
): BufferedRealtimeEvent[] {
  if (!Number.isFinite(since) || since < 0) {
    return events.slice();
  }
  return events.filter((item) => item.seq > since);
}

export function parseRealtimeEvent(raw: unknown): MailboxRealtimeEvent | null {
  const parsed = MailboxRealtimeEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseWebSocketAttachment(raw: unknown): WebSocketAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const userId = (raw as { userId?: unknown }).userId;
  const connectedAt = (raw as { connectedAt?: unknown }).connectedAt;
  if (typeof userId !== 'string' || !userId) return null;
  if (typeof connectedAt !== 'string' || !connectedAt) return null;
  return { userId, connectedAt };
}

/**
 * Minimal Durable Object namespace surface used by notify/poll helpers.
 * Avoids coupling callers to the full Workers type graph.
 */
export type MailboxRealtimeStub = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type MailboxRealtimeNamespace = {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): MailboxRealtimeStub;
};

/**
 * Fan-out a mailbox event to the per-mailbox Durable Object.
 * Failures are returned (not thrown) so ingest/send can stay best-effort.
 */
export async function notifyMailboxRealtime(
  ns: MailboxRealtimeNamespace,
  event: MailboxRealtimeEvent,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (event.type === 'ping') {
    return { ok: true };
  }

  try {
    const id = ns.idFromName(event.mailboxId);
    const stub = ns.get(id);
    const response = await stub.fetch(
      new Request('https://mailbox-realtime/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      }),
    );
    if (!response.ok) {
      return { ok: false, error: `notify failed (${response.status})` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'notify failed',
    };
  }
}

export async function pollMailboxRealtime(
  ns: MailboxRealtimeNamespace,
  mailboxId: string,
  since: number,
): Promise<{ seq: number; events: BufferedRealtimeEvent[] }> {
  const id = ns.idFromName(mailboxId);
  const stub = ns.get(id);
  const response = await stub.fetch(
    new Request(`https://mailbox-realtime/poll?since=${encodeURIComponent(String(since))}`),
  );
  if (!response.ok) {
    throw new Error(`poll failed (${response.status})`);
  }
  const data = (await response.json()) as {
    seq: number;
    events: BufferedRealtimeEvent[];
  };
  return {
    seq: data.seq ?? since,
    events: Array.isArray(data.events) ? data.events : [],
  };
}

export async function upgradeMailboxRealtimeWebSocket(
  ns: MailboxRealtimeNamespace,
  mailboxId: string,
  request: Request,
  attachment: WebSocketAttachment,
): Promise<Response> {
  const id = ns.idFromName(mailboxId);
  const stub = ns.get(id);
  const headers = new Headers(request.headers);
  headers.set('x-yfm-ws-user-id', attachment.userId);
  headers.set('x-yfm-ws-connected-at', attachment.connectedAt);
  headers.set('x-yfm-mailbox-id', mailboxId);
  // Forward the original Upgrade request so the runtime can complete the handshake.
  return stub.fetch(new Request(request, { headers }));
}
