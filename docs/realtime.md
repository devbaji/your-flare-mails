# Realtime mailbox updates (Phase 7)

Clients stay in sync with mailbox changes without polling the full REST surface
on a timer. Events carry **ids only**; UIs refresh threads/messages via existing
HTTP APIs.

## Architecture

```
ingest / send (packages/server)
  → notifyMailboxRealtime(MAILBOX_REALTIME, event)
  → MailboxRealtime Durable Object (one per mailbox via idFromName)
  → fan-out to hibernated WebSocket clients
  → also buffers recent events for poll fallback
```

- **Class:** `MailboxRealtime` in `@your-flare-mails/cloudflare`
- **Binding:** `MAILBOX_REALTIME` on `workers/api` only (not on email-receiver)
- **Hibernation:** `ctx.acceptWebSocket` + `webSocketMessage` / `webSocketClose` /
  `webSocketError`, with `serializeAttachment` / `deserializeAttachment` for
  per-connection `{ userId, connectedAt }`

REST handlers stay on the Worker. The Durable Object does not own mailbox CRUD.

## Event schema

Zod: `MailboxRealtimeEvent` in `@your-flare-mails/core`

| `type` | When |
| --- | --- |
| `message.created` | Successful inbound ingest |
| `message.sent` | Successful draft send |
| `mailbox.changed` | Generic mailbox state change (reserved) |
| `ping` | Client/server keepalive |

Wire payload to clients is usually `{ seq, event }` so poll cursors stay aligned.

## HTTP routes (`workers/api`)

| Route | Purpose |
| --- | --- |
| `GET /api/mailboxes/:id/ws` | WebSocket upgrade → Durable Object |
| `GET /api/mailboxes/:id/events/poll?since=N` | Poll events with `seq > N` |

Authorization: same mailbox membership checks as other mailbox routes.

**WebSocket auth:** prefer session cookie (same-origin) or
`?access_token=<sessionToken>` (browsers cannot set `Authorization` on the
handshake). Dev-only `?userId=` works only when `ALLOW_DEV_USER_HEADER=true`.

## Client

```ts
const { transport, lastEvent, lastSeq } = useRealtimeMailbox(mailboxId)
```

- Prefers WebSocket; on close/error falls back to **poll every 5s**, then retries WS.
- `apps/web` refreshes the thread list (and open thread) when non-`ping` events arrive.

## Local smoke

```bash
pnpm dev:api   # :8787 — only one wrangler on this port
```

Poll (replace `mbx_…` from seed / list mailboxes):

```bash
curl -s -H "authorization: Bearer $TOKEN" \
  'http://127.0.0.1:8787/api/mailboxes/MAILBOX_ID/events/poll?since=0'
```

After ingest or send, `seq` should increase and `events` should include
`message.created` / `message.sent`.
