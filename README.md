# YourFlareMails

Open-source, Cloudflare-native framework and reference app for a self-hosted
email mailbox on a domain you manage in Cloudflare (e.g. `hello@example.com`).

## Quick start (local)

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev:api    # http://127.0.0.1:8787
pnpm dev:web    # http://127.0.0.1:3000
```

Sign in: `owner@example.com` / `owner-dev-password`  
No real domain required for local work. See [docs/local-development.md](./docs/local-development.md).

## Deploy to Cloudflare

End-to-end hosting (D1, R2, Workers, custom domains, Email Routing / Sending):

→ **[docs/deploy.md](./docs/deploy.md)**

Short version:

```bash
cp config/deploy.example.env config/deploy.local.env   # edit your values
pnpm deploy:configure
# wrangler secret put INGEST_HMAC_SECRET / BLOB_SIGNING_SECRET (see deploy.md)
pnpm db:migrate:remote && pnpm db:seed:remote
pnpm deploy:api && pnpm deploy:web
```

Secrets and personal hostnames stay in **gitignored** files. Do not commit
`config/deploy.local.env`, `*.wrangler.deploy.jsonc`, or production seed SQL.

## Monorepo map

```
apps/web                 Nuxt reference UI
apps/desktop             Tauri 2 shell
packages/*               core, cloudflare, server, nuxt, ui, theme, api-client
workers/api              HTTP API Worker
workers/email-receiver   Inbound Email Worker
infra/                   D1 migrations + seed
config/                  deploy.example.env (copy → deploy.local.env)
docs/                    Architecture + deploy guides
```

## Status

Phases 0–10 implemented (through mobile push). Phase 11 will add CLI provisioning;
until then use [docs/deploy.md](./docs/deploy.md).

## Documentation

| Doc | Topic |
| --- | --- |
| [docs/deploy.md](./docs/deploy.md) | **Production Cloudflare setup** |
| [docs/local-development.md](./docs/local-development.md) | Local D1 / fixtures |
| [docs/README.md](./docs/README.md) | Full doc index |
| [CURSOR_MASTER_PROMPT.md](./CURSOR_MASTER_PROMPT.md) | Product / roadmap |

## License

[MIT](./LICENSE)
