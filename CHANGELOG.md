# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Phase 8 auth: PBKDF2 passwords, D1 sessions, `POST /api/auth/login|logout` +
  `GET /api/auth/me`, Bearer/cookie identity (replacing spoofable user headers by
  default), CSRF on cookie mutations, ingest/login rate limits, optional
  Cloudflare Access JWT mode, separate `BLOB_SIGNING_SECRET`, and
  [docs/auth.md](./docs/auth.md).
- Phase 7 realtime: per-mailbox `MailboxRealtime` Durable Object (WebSocket
  Hibernation), ingest/send fan-out, `GET …/ws` + poll fallback,
  `useRealtimeMailbox()`, and [docs/realtime.md](./docs/realtime.md).
- Phase 6 outbound compose: `CloudflareEmailTransport` + `MockMailTransport` send
  path, draft create/update/delete/send APIs, reply/forward draft helpers,
  `Composer` + `useCompose()` autosave UI, and send confirmation/errors.
- Phase 5 threading/search/attachments: subject/participant thread fallback with
  fixtures, FTS5 BM25 search API + `useMailSearch` UI, message attachment download,
  draft attachment upload (`draft_attachments`), and local R2 seed for the invoice
  PDF.
- Phase 4 Nuxt reference UI: `@your-flare-mails/theme` tokens (light/dark),
  `@your-flare-mails/ui` primitives, Nuxt module composables, typed API client,
  and read-only mailbox view in `apps/web` (`pnpm dev:web`).
- Phase 3 mailbox APIs: D1 repositories, `mailbox`/`thread`/`message`/`attachment`
  services with mailbox membership checks, HMAC-signed private R2 download URLs,
  and read routes on `workers/api` (temporary `X-YFM-User-Id` until Phase 8).
- Phase 2 inbound pipeline: `postal-mime` normalization, HMAC-signed
  `POST /api/inbound/email`, nonce replay protection, fingerprint idempotency,
  basic `In-Reply-To`/`References` threading, `workers/api` + `workers/email-receiver`,
  and `pnpm ingest:fixture`.
- Phase 1 core domain model: Zod entity schemas, message fingerprint helper,
  `MailTransport` / `MockMailTransport`, and `BODY_INLINE_MAX_BYTES` (8 KiB).
- Local D1 schema (`infra/migrations/0001_init.sql`) with FTS5 + sync triggers,
  Wrangler D1/R2 config, idempotent seed (`hello@example.com`), and MIME fixtures.
- Docs: [docs/local-development.md](./docs/local-development.md); architecture
  storage notes updated.
- Phase 0 monorepo foundation: pnpm workspaces, shared TypeScript/ESLint/Vitest
  tooling, empty-but-wired packages/apps/workers, open-source docs stubs, and CI.
