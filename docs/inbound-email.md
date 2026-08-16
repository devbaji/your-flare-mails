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

## Threading (Phase 5)

1. Match `In-Reply-To` against existing `messages.message_id_header` in the mailbox.
2. Else walk `References` (newest → oldest) for the first match.
3. Else **subject/participant fallback**: within the last 45 days, find a thread
   whose normalized subject matches (strip repeated `Re:`/`Fwd:`/`Fw:`/`Aw:`/`Wg:`/`Sv:`)
   **and** shares at least one participant address with the inbound message
   (`From` / `To` / `Cc` vs the latest message in the candidate thread).
4. Else create a new thread.

Empty subjects never join via fallback (they open a new thread). Fallback is
best-effort for mailers that omit threading headers — prefer proper
`Message-ID` / `In-Reply-To` / `References` when available.

Fixtures:

- `fixtures/emails/references-chain-*.eml` — References walk
- `fixtures/emails/subject-fallback-*.eml` — subject/participant fallback

## Body storage + search

Bodies larger than `BODY_INLINE_MAX_BYTES` (8 KiB) store the **full text in R2**
and keep a truncated **searchable prefix** inline in `messages.body_text` so
FTS5 still indexes useful content.

## Security notes

- Treat all MIME/HTML/attachments as untrusted.
- HTML renders only in a sandboxed iframe in the UI (`sandbox=""`).
- Ingest HMAC is an MVP shared secret — harden in Phase 8.
