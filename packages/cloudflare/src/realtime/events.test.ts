import { describe, expect, it } from 'vitest';

import {
  appendRealtimeEvent,
  eventsSince,
  notifyMailboxRealtime,
  parseRealtimeEvent,
} from './events.js';

describe('realtime event buffer', () => {
  it('appends and trims the ring buffer', () => {
    const event = {
      type: 'message.created' as const,
      mailboxId: 'mbx_1',
      messageId: 'msg_1',
      threadId: 'thr_1',
      at: '2026-08-17T00:00:00.000Z',
    };
    let seq = 0;
    let events: ReturnType<typeof appendRealtimeEvent>['events'] = [];
    for (let i = 0; i < 5; i += 1) {
      const next = appendRealtimeEvent(events, seq, event, 3);
      seq = next.seq;
      events = next.events;
    }
    expect(seq).toBe(5);
    expect(events).toHaveLength(3);
    expect(events[0]?.seq).toBe(3);
    expect(events[2]?.seq).toBe(5);
  });

  it('filters events after a cursor', () => {
    const base = {
      type: 'message.sent' as const,
      mailboxId: 'mbx_1',
      messageId: 'msg_1',
      threadId: 'thr_1',
      at: '2026-08-17T00:00:00.000Z',
    };
    const events = [
      { seq: 1, event: base },
      { seq: 2, event: base },
      { seq: 3, event: base },
    ];
    expect(eventsSince(events, 1).map((e) => e.seq)).toEqual([2, 3]);
  });

  it('parses valid events and rejects junk', () => {
    expect(
      parseRealtimeEvent({
        type: 'ping',
        at: '2026-08-17T00:00:00.000Z',
      }),
    ).toEqual({ type: 'ping', at: '2026-08-17T00:00:00.000Z' });
    expect(parseRealtimeEvent({ type: 'nope' })).toBeNull();
  });
});

describe('notifyMailboxRealtime', () => {
  it('posts to the mailbox Durable Object stub', async () => {
    const calls: Request[] = [];
    const ns = {
      idFromName(name: string) {
        return { toString: () => `id:${name}` };
      },
      get() {
        return {
          async fetch(input: RequestInfo | URL) {
            const request = input instanceof Request ? input : new Request(input);
            calls.push(request);
            return Response.json({ ok: true });
          },
        };
      },
    };

    const result = await notifyMailboxRealtime(ns, {
      type: 'message.created',
      mailboxId: 'mbx_seed',
      messageId: 'msg_1',
      threadId: 'thr_1',
      at: '2026-08-17T00:00:00.000Z',
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).pathname).toBe('/notify');
    expect(calls[0]!.method).toBe('POST');
  });
});
