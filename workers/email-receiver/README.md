# `@your-flare-mails/email-receiver`

Cloudflare Email Worker: `email()` handler.

1. Optional best-effort `message.forward()` to verified Email Routing destinations
   (`FORWARD_BACKUP_ADDRESSES`, comma-separated) — **before** reading the raw stream.
2. Parse MIME → HMAC-signed `POST /api/inbound/email` (app mailbox / D1).

Forward failures are logged and **never** skip ingest. The app is authoritative.

```bash
pnpm deploy:configure
pnpm --filter @your-flare-mails/email-receiver exec wrangler secret put INGEST_HMAC_SECRET --config wrangler.deploy.jsonc
pnpm deploy:email-receiver
```

Then point Email Routing for your address at this Worker (replace any Gmail-only forwarder).

Local:

```bash
pnpm --filter @your-flare-mails/api dev
pnpm --filter @your-flare-mails/email-receiver dev
pnpm ingest:fixture fixtures/emails/plain-text.eml
```
