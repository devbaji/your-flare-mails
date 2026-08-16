# Inbound email

## Flow

```
Email Routing → workers/email-receiver (email handler)
  → MIME parse (postal-mime via packages/cloudflare)
  → fingerprint + HMAC-signed JSON
  → POST /api/inbound/email (workers/api)
  → packages/server ingestEmail()
  → D1 metadata + R2 raw MIME/attachments
```

Local fixture injection uses the same signed POST path (`pnpm ingest:fixture`).

## Threading (Phase 2)

1. Match `In-Reply-To` against existing `messages.message_id_header` in the mailbox.
2. Else walk `References` (newest → oldest) for the first match.
3. Else create a new thread.

Subject/participant fallback heuristics are deferred to Phase 5.

## Security notes

- Treat all MIME/HTML/attachments as untrusted.
- HTML is stored but **not** rendered in Phase 2 (sandboxing lands with UI).
- Ingest HMAC is an MVP shared secret — harden in Phase 8.
