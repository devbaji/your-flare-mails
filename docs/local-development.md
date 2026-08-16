# Local development

You can exercise the domain model and local D1/R2 loop **without** owning a real
domain or Cloudflare account credentials for Email Routing.

## Prerequisites

- Node.js 22+
- pnpm 10+

## Setup

```bash
pnpm install
pnpm db:migrate   # apply D1 migrations to local Wrangler state
pnpm db:seed      # idempotent realistic mailbox seed
pnpm fixtures:check
```

Reset local D1 state and re-seed:

```bash
pnpm db:reset
```

## What you get

| Piece | Location |
| --- | --- |
| Domain Zod schemas + HMAC + `MockMailTransport` | `packages/core` |
| MIME parse + D1/R2 ingest adapters | `packages/cloudflare` |
| `ingestEmail()` service | `packages/server` |
| HTTP ingest API Worker | `workers/api` |
| Email Routing Worker | `workers/email-receiver` |
| D1 schema + FTS5 triggers | `infra/migrations/` |
| Idempotent seed (`hello@example.com`) | `infra/seed/seed.sql` |
| Raw MIME fixtures | `fixtures/emails/` |

Seeded mailbox address: **`hello@example.com`** on domain **`example.com`**.

## Ingest API (Phase 2)

Start the API Worker (binds local D1 + R2):

```bash
pnpm dev:api
```

Inject a fixture through the **same** HMAC-signed path used by the Email Worker:

```bash
pnpm ingest:fixture fixtures/emails/plain-text.eml
```

Defaults (overridable via env / `.env.example`):

- `INGEST_URL=http://127.0.0.1:8787`
- `INGEST_HMAC_SECRET=dev-ingest-hmac-secret-change-me`
- Envelope recipient `hello@example.com` (must exist in the seeded mailbox)

Idempotency: re-sending the same Message-ID/fingerprint returns `duplicate` and does
not create a second `messages` row. Nonces are recorded in `ingestion_nonces`.

### Ingestion auth (MVP)

`POST /api/inbound/email` requires:

- HMAC-SHA256 over the raw body (`x-yfm-signature`)
- Unix timestamp within 5 minutes (`x-yfm-timestamp`, also inside JSON body)
- Unique nonce (`x-yfm-nonce`, also inside JSON body)
- Constant-time signature comparison

A single shared secret is acceptable for the MVP. Production should move to a
stronger signed-request design (asymmetric keys or a Cloudflare-native
verification primitive if available) in Phase 8.

Optional backup forwarding from the Email Worker (`FORWARD_BACKUP_ENABLED`)
defaults to **off**.

## Body storage threshold

Plain-text bodies larger than **8192 bytes** (`BODY_INLINE_MAX_BYTES`) are stored
in R2 with a D1 pointer. Smaller bodies may live inline in `messages.body_text`.
Attachment bytes and raw MIME always go to the private R2 bucket.

## Outbound mail in dev

Use `MockMailTransport` from `@your-flare-mails/core`. The Email Worker's
`send_email` binding is simulated locally by Wrangler (logged, not sent) unless
you set `remote: true` deliberately.

## Mailbox read APIs

See [mailbox-apis.md](./mailbox-apis.md). Temporary auth header for Phase 3:

```bash
curl -s -H 'x-yfm-user-id: user_seed_owner' http://127.0.0.1:8787/api/mailboxes
```

## Web UI

See [web-ui.md](./web-ui.md):

```bash
pnpm dev:api
pnpm dev:web
```

## Verify

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm fixtures:check
```
