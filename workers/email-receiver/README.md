# `@your-flare-mails/email-receiver`

Cloudflare Email Worker: `email()` handler parses MIME, signs an ingest request,
and `POST`s to `/api/inbound/email`.

Optional migration backup forwarding via `send_email` is **off** by default
(`FORWARD_BACKUP_ENABLED=false`).

```bash
# Terminal A — API
pnpm --filter @your-flare-mails/api dev

# Terminal B — email receiver (local email binding is simulated)
pnpm --filter @your-flare-mails/email-receiver dev
```

Prefer injecting fixtures through the API for day-to-day local testing:

```bash
pnpm ingest:fixture fixtures/emails/plain-text.eml
```
