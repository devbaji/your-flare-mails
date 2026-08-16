# Search (Phase 5)

Mailbox search uses D1 **FTS5** (`messages_fts`) with BM25 ranking. The index
stays in sync via SQLite triggers on `messages` insert/update/delete — application
code never writes to `messages_fts` directly.

## Indexed fields

- `subject`
- `body_text` (inline / searchable prefix; see [inbound-email.md](./inbound-email.md))
- `from_address`
- `recipients_text`

## API

```http
GET /api/mailboxes/:id/search
  ?q=invoice
  &from=
  &to=
  &subject=
  &after=
  &before=
  &unread=1
  &hasAttachment=1
  &label=inbox
  &limit=25
```

Requires a valid session (`Authorization: Bearer …`). See [auth.md](./auth.md).

Filters compose with optional FTS `q`. When `q` is empty, only SQL filters apply
(ordered by `messages.date` descending).

## UI

`apps/web` search bar uses `useMailSearch()` from `@your-flare-mails/nuxt`.
