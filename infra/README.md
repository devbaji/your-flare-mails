# `infra/`

Local Cloudflare resource config for YourFlareMails.

| Path | Purpose |
| --- | --- |
| `wrangler.jsonc` | Local D1 + R2 bindings |
| `migrations/` | D1 SQL migrations |
| `seed/seed.sql` | Idempotent local mailbox seed |
| `scripts/check-fixtures.mjs` | Validate `fixtures/emails/` |
| `worker-stub.ts` | Minimal entry so Wrangler can load bindings |

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:reset
pnpm fixtures:check
```

Remote provisioning and Email Service bindings land in later phases.
