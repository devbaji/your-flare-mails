# Architecture

YourFlareMails is a **framework** for building email applications on Cloudflare,
plus a polished default (reference) app that dogfoods the public APIs.

## Four layers

1. **Core** (`packages/core`) — email domain model, Zod schemas, fingerprinting,
   `MailTransport` / `MockMailTransport`. No UI, no Cloudflare SDK, no Vue/Nuxt.
2. **Framework APIs** (`packages/server`, `packages/nuxt`, `packages/api-client`) —
   composables and server services. Framework-aware, UI-agnostic.
3. **UI primitives** (`packages/ui`) — themeable Vue components built on the
   framework APIs. Replaceable independently of the default theme.
4. **Default theme / reference app** (`packages/theme`, `apps/web`) — the shipped
   email client. Proof that layers 1–3 are sufficient on their own.

Layer 4 must not leak private details into layers 1–3. Layer 1 must not import
anything from Vue or Nuxt.

## Storage (Phase 1)

- **D1** holds users, domains, mailboxes, threads, messages (metadata + small
  text bodies), recipients, labels, drafts, contacts, devices, notification
  subscriptions, settings, and an FTS5 virtual table (`messages_fts`).
- **R2** (local binding configured in `infra/wrangler.jsonc`) will hold
  attachments, inline images, raw MIME, and bodies over `BODY_INLINE_MAX_BYTES`
  (8 KiB). Persistence code lands in Phase 3; the binding exists so local Wrangler
  state matches the intended shape.
- FTS5 stays in sync via SQLite triggers on `messages` insert/update/delete —
  application code must not manually maintain the index.
- Required indexes include `messages(thread_id)`, `messages(mailbox_id, date)`,
  and `messages(message_id_header)` for thread views, mailbox lists, and
  idempotency lookups.

## Platform (Cloudflare-native)

- **Inbound:** Email Routing → `workers/email-receiver` → HMAC `POST /api/inbound/email`
  on `workers/api` → `ingestEmail()` in `packages/server` (see
  [inbound-email.md](./inbound-email.md))
- **Mailbox APIs:** repositories in `packages/cloudflare`, services in
  `packages/server`, HTTP on `workers/api` (see [mailbox-apis.md](./mailbox-apis.md))
- **Attachments:** private R2; short-lived HMAC download tokens (never public bucket URLs).
  Draft uploads land in `draft_attachments` (Phase 5); compose UI is Phase 6.
- **Search:** D1 FTS5 + BM25 via triggers; see [search.md](./search.md)
- **Outbound:** `MailTransport` → `CloudflareEmailTransport` / `MockMailTransport`
  (see [outbound-email.md](./outbound-email.md))
- **Realtime:** per-mailbox `MailboxRealtime` Durable Object + WebSocket
  Hibernation; poll fallback (see [realtime.md](./realtime.md))
- **Auth:** session cookies + Bearer tokens; optional Cloudflare Access
  (see [auth.md](./auth.md))
- **Desktop:** Tauri 2 shell with local notifications + keychain sessions
  (see [desktop.md](./desktop.md))
- **Mobile push:** APNs/FCM via `tauri-plugin-mobile-push` + device registration
  (see [mobile.md](./mobile.md))

## Domain model

Canonical Zod schemas live in `@your-flare-mails/core`. Shared entity TypeScript
types are re-exported from `@your-flare-mails/types` for consumers that prefer a
types-only import path.

Message idempotency uses `computeMessageFingerprint()` (Message-ID + envelope
recipients, with a content-hash fallback).
