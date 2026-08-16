import type { Ref } from '#imports';
import {
  onBeforeUnmount,
  onMounted,
  ref,
  unref,
  useRuntimeConfig,
  useState,
  watch,
} from '#imports';

import { useYfmApi } from './useMailbox.js';

export type RealtimeTransport = 'websocket' | 'poll' | 'disconnected';

/** Ids-only mailbox events (mirrors @your-flare-mails/core MailboxRealtimeEvent). */
export type MailboxRealtimeEventDto =
  | {
      type: 'message.created';
      mailboxId: string;
      messageId: string;
      threadId: string;
      at: string;
    }
  | {
      type: 'message.sent';
      mailboxId: string;
      messageId: string;
      threadId: string;
      at: string;
    }
  | {
      type: 'mailbox.changed';
      mailboxId: string;
      at: string;
      reason?: string;
    }
  | {
      type: 'ping';
      at: string;
    };

function toWsBase(httpBase: string): string {
  if (httpBase.startsWith('https://')) return `wss://${httpBase.slice('https://'.length)}`;
  if (httpBase.startsWith('http://')) return `ws://${httpBase.slice('http://'.length)}`;
  return httpBase;
}

function resolveMailboxId(mailboxId: Ref<string | null> | string): string | null {
  return typeof mailboxId === 'string' ? mailboxId : mailboxId.value;
}

function asRealtimeEvent(raw: unknown): MailboxRealtimeEventDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = (raw as { type?: unknown }).type;
  if (typeof type !== 'string') return null;
  if (
    type === 'message.created' ||
    type === 'message.sent' ||
    type === 'mailbox.changed' ||
    type === 'ping'
  ) {
    return raw as MailboxRealtimeEventDto;
  }
  return null;
}

/**
 * Subscribe to per-mailbox realtime events (WebSocket Hibernation with poll fallback).
 * Events carry ids only — callers should refresh REST data on relevant events.
 */
export function useRealtimeMailbox(
  mailboxId: Ref<string | null> | string,
  options: {
    onEvent?: (event: MailboxRealtimeEventDto, seq: number) => void;
    pollIntervalMs?: number;
    enabled?: Ref<boolean> | boolean;
  } = {},
) {
  const api = useYfmApi();
  const config = useRuntimeConfig();
  const yfm = config.public.yourFlareMails as {
    apiBaseUrl: string;
  };

  const transport = useState<RealtimeTransport>(
    'yfm-realtime-transport',
    () => 'disconnected',
  );
  const lastEvent = useState<MailboxRealtimeEventDto | null>(
    'yfm-realtime-last-event',
    () => null,
  );
  const lastSeq = useState('yfm-realtime-seq', () => 0);
  const error = useState<string | null>('yfm-realtime-error', () => null);
  const sessionToken = useState<string | null>('yfm-session-token', () => null);

  const socketRef = ref<WebSocket | null>(null);
  const pollTimer = ref<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimer = ref<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = ref(false);

  const pollIntervalMs = options.pollIntervalMs ?? 5000;

  function isEnabled(): boolean {
    if (options.enabled === undefined) return true;
    return Boolean(unref(options.enabled));
  }

  function clearPoll() {
    if (pollTimer.value) {
      clearInterval(pollTimer.value);
      pollTimer.value = null;
    }
  }

  function clearReconnect() {
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value);
      reconnectTimer.value = null;
    }
  }

  function handleEnvelope(seq: number, event: MailboxRealtimeEventDto) {
    if (seq > lastSeq.value) lastSeq.value = seq;
    lastEvent.value = event;
    options.onEvent?.(event, seq);
  }

  function parseSocketMessage(raw: string) {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;

    const record = data as Record<string, unknown>;
    if (record.type === 'hello' && typeof record.seq === 'number') {
      if (record.seq > lastSeq.value) lastSeq.value = record.seq;
      return;
    }

    if (typeof record.seq === 'number' && record.event) {
      const event = asRealtimeEvent(record.event);
      if (event) handleEnvelope(record.seq, event);
      return;
    }

    const direct = asRealtimeEvent(record);
    if (direct) handleEnvelope(lastSeq.value, direct);
  }

  async function pollOnce() {
    const id = resolveMailboxId(mailboxId);
    if (!id) return;
    try {
      const result = await api.pollMailboxEvents(id, lastSeq.value);
      lastSeq.value = result.seq;
      for (const item of result.events) {
        const event = asRealtimeEvent(item.event);
        if (event) handleEnvelope(item.seq, event);
      }
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'poll failed';
    }
  }

  function startPolling() {
    clearPoll();
    transport.value = 'poll';
    void pollOnce();
    pollTimer.value = setInterval(() => {
      void pollOnce();
    }, pollIntervalMs);
  }

  function connectWebSocket(id: string) {
    if (!import.meta.client) return;
    intentionalClose.value = false;
    clearPoll();
    clearReconnect();

    const url = new URL(
      `/api/mailboxes/${encodeURIComponent(id)}/ws`,
      toWsBase(yfm.apiBaseUrl),
    );
    if (sessionToken.value) {
      url.searchParams.set('access_token', sessionToken.value);
    }

    transport.value = 'websocket';
    const socket = new WebSocket(url.toString());
    socketRef.value = socket;

    socket.addEventListener('open', () => {
      error.value = null;
      transport.value = 'websocket';
    });

    socket.addEventListener('message', (message) => {
      if (typeof message.data === 'string') parseSocketMessage(message.data);
    });

    socket.addEventListener('close', () => {
      socketRef.value = null;
      if (intentionalClose.value || !isEnabled()) {
        transport.value = 'disconnected';
        return;
      }
      startPolling();
      reconnectTimer.value = setTimeout(() => {
        const current = resolveMailboxId(mailboxId);
        if (current && isEnabled()) connectWebSocket(current);
      }, 8_000);
    });

    socket.addEventListener('error', () => {
      error.value = 'websocket error';
      try {
        socket.close();
      } catch {
        // ignore
      }
    });
  }

  function disconnect() {
    intentionalClose.value = true;
    clearPoll();
    clearReconnect();
    if (socketRef.value) {
      try {
        socketRef.value.close(1000, 'client disconnect');
      } catch {
        // ignore
      }
      socketRef.value = null;
    }
    transport.value = 'disconnected';
  }

  function connect() {
    const id = resolveMailboxId(mailboxId);
    if (!id || !isEnabled()) {
      disconnect();
      return;
    }
    if (!import.meta.client) return;
    connectWebSocket(id);
  }

  watch(
    () => resolveMailboxId(mailboxId),
    () => {
      disconnect();
      connect();
    },
  );

  if (options.enabled !== undefined && typeof options.enabled !== 'boolean') {
    watch(options.enabled, (enabled: boolean) => {
      if (enabled) connect();
      else disconnect();
    });
  }

  onMounted(() => {
    connect();
  });

  onBeforeUnmount(() => {
    disconnect();
  });

  return {
    transport,
    lastEvent,
    lastSeq,
    error,
    connect,
    disconnect,
    pollOnce,
  };
}
