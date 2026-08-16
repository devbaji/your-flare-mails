# `@your-flare-mails/web`

Nuxt reference application for YourFlareMails (Phase 4 — read-only mailbox UI).

## Run locally

```bash
# Terminal 1 — API + D1/R2
pnpm db:migrate && pnpm db:seed
pnpm dev:api

# Terminal 2 — web UI
pnpm --filter @your-flare-mails/web dev
```

Open http://localhost:3000 — redirects to `/mail`.
