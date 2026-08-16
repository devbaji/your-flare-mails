# `@your-flare-mails/api`

Minimal Cloudflare Worker hosting `POST /api/inbound/email` for Phase 2.

Phase 4 will move HTTP routes into the Nuxt/Nitro app while keeping
`ingestEmail()` in `@your-flare-mails/server`.

```bash
pnpm --filter @your-flare-mails/api dev
```
