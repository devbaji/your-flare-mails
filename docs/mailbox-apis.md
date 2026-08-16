# Mailbox APIs

APIs are hosted on `workers/api`. The Nuxt reference app consumes them via
`@your-flare-mails/api-client` and composables from `@your-flare-mails/nuxt`.

All mailbox-scoped routes require temporary identity header:

```http
X-YFM-User-Id: user_seed_owner
```

(Seed user from `infra/seed/seed.sql`. Replaced by real sessions in Phase 8.)

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/mailboxes` | List mailboxes for the user |
| GET | `/api/mailboxes/:id` | Mailbox detail |
| GET | `/api/mailboxes/:id/threads?label=&before=&limit=` | Paginated threads |
| GET | `/api/mailboxes/:id/search?...` | FTS5 + filter search (Phase 5) |
| GET | `/api/mailboxes/:id/drafts` | List drafts (Phase 5 upload surface) |
| GET | `/api/threads/:id` | Thread detail |
| GET | `/api/threads/:id/messages` | Messages in thread (oldest → newest) |
| GET | `/api/messages/:id` | Message + recipients + attachment metadata |
| GET | `/api/attachments/:id` | Attachment metadata |
| POST | `/api/attachments/:id/url` | Mint short-lived download URL |
| GET | `/api/attachments/:id/content?token=` | Stream bytes (token auth, private R2) |
| GET | `/api/drafts/:id` | Draft detail |
| GET | `/api/drafts/:id/attachments` | List draft attachments |
| POST | `/api/drafts/:id/attachments` | Upload draft attachment (raw body + `X-YFM-Filename`) |
| POST | `/api/draft-attachments/:id/url` | Mint draft attachment download URL |
| GET | `/api/draft-attachments/:id/content?token=` | Stream draft attachment bytes |

Search query parameters: see [search.md](./search.md).

## Attachment access model

The R2 bucket stays **private**. After authorization, the API mints an HMAC-signed
token (default TTL 5 minutes) pointing at `/api/attachments/:id/content` (or the
draft-attachment equivalent). There is no public bucket URL.

Draft upload (Phase 5) stores bytes under
`mailboxes/{mailboxId}/drafts/{draftId}/…` and records metadata in
`draft_attachments`. Full compose UI arrives in Phase 6 and will reuse this path.

## Local example

```bash
pnpm db:migrate && pnpm db:seed
pnpm dev:api

curl -s -H 'x-yfm-user-id: user_seed_owner' \
  'http://127.0.0.1:8787/api/mailboxes/mbx_seed_hello/search?q=invoice' | jq

curl -s -H 'x-yfm-user-id: user_seed_owner' \
  -X POST http://127.0.0.1:8787/api/attachments/att_seed_invoice_pdf/url | jq
```
