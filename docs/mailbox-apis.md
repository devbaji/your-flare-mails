# Mailbox APIs (Phase 3)

Read APIs are hosted on `workers/api`. The Nuxt reference app (`apps/web`) consumes
them via `@your-flare-mails/api-client` and composables from `@your-flare-mails/nuxt`
(Phase 4). Nitro may host these routes in a later consolidation; for now keep the
API Worker running locally beside the UI.

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
| GET | `/api/threads/:id` | Thread detail |
| GET | `/api/threads/:id/messages` | Messages in thread (oldest → newest) |
| GET | `/api/messages/:id` | Message + recipients + attachment metadata |
| GET | `/api/attachments/:id` | Attachment metadata |
| POST | `/api/attachments/:id/url` | Mint short-lived download URL |
| GET | `/api/attachments/:id/content?token=` | Stream bytes (token auth, private R2) |

## Attachment access model

The R2 bucket stays **private**. After authorization, the API mints an HMAC-signed
token (default TTL 5 minutes) pointing at `/api/attachments/:id/content`. There is
no public bucket URL. Production may later also issue S3-style R2 presigns when
account API tokens are configured; the service abstraction stays the same.

## Local example

```bash
pnpm db:migrate && pnpm db:seed
pnpm dev:api

curl -s -H 'x-yfm-user-id: user_seed_owner' \
  http://127.0.0.1:8787/api/mailboxes | jq

curl -s -H 'x-yfm-user-id: user_seed_owner' \
  'http://127.0.0.1:8787/api/mailboxes/mbx_seed_hello/threads?label=inbox' | jq
```
