# Deploy YourFlareMails on Cloudflare

This guide gets a fresh clone onto Cloudflare with **your** domain. Personal
hostnames, D1 IDs, and secrets are **not** committed — you supply them via
`config/deploy.local.env` and `wrangler secret put`.

## What you need

| Requirement | Notes |
| --- | --- |
| Node.js 22+ / pnpm 10+ | See root `package.json` `engines` / `packageManager` |
| Cloudflare account | Zone for your domain (e.g. `example.com`) on Cloudflare DNS |
| Workers Paid | Required for **outbound** Email Sending; inbound Routing works on Free |
| Domain | Suggested split: web `mail.example.com`, API `api.example.com` |

## Security rules

- **Never commit** `.env`, `.dev.vars`, `config/deploy.local.env`, `wrangler.deploy.jsonc`, or `infra/seed/seed-prod.sql`.
- Production HMAC secrets go only through `wrangler secret put` (not `vars` in git).
- Local placeholders in `wrangler.jsonc` (`dev-ingest-hmac-secret-change-me`) are for **local** `wrangler dev` only.

## One-time Cloudflare setup

```bash
pnpm install
pnpm --filter @your-flare-mails/infra exec wrangler login
```

### 1. Create D1 + R2

```bash
pnpm --filter @your-flare-mails/infra exec wrangler d1 create your-flare-mails
pnpm --filter @your-flare-mails/infra exec wrangler r2 bucket create your-flare-mails-attachments
```

Copy the printed `database_id`.

### 2. Fill deploy env

```bash
cp config/deploy.example.env config/deploy.local.env
# edit: D1_DATABASE_ID, hostnames, mailbox domain, CORS, NUXT_PUBLIC_API_BASE_URL
```

### 3. Generate Wrangler deploy configs

```bash
pnpm deploy:configure
```

This writes **gitignored** files:

- `workers/api/wrangler.deploy.jsonc`
- `apps/web/wrangler.deploy.jsonc`
- `workers/email-receiver/wrangler.deploy.jsonc`
- `infra/wrangler.deploy.jsonc`
- `apps/web/.env.production.local`

### 4. Secrets (API)

Generate two long random values (`openssl rand -hex 32`). Keep them — the email
receiver must share the ingest secret.

```bash
cd workers/api
pnpm exec wrangler secret put INGEST_HMAC_SECRET --config wrangler.deploy.jsonc
pnpm exec wrangler secret put BLOB_SIGNING_SECRET --config wrangler.deploy.jsonc
cd ../..
```

### 5. Migrate + seed remote D1

```bash
cp infra/seed/seed-prod.example.sql infra/seed/seed-prod.sql
# Replace __OWNER_EMAIL__, __MAIL_DOMAIN__, __MAILBOX_ADDRESS__, __LOCAL_PART__, __PASSWORD_HASH__
pnpm --filter @your-flare-mails/infra run hash-password -- 'your-strong-password'
# paste hash into seed-prod.sql

pnpm db:migrate:remote
pnpm db:seed:remote
```

### 6. Deploy API + web

```bash
pnpm deploy:api
pnpm deploy:web
```

Open `https://<WEB_HOSTNAME>/login` and sign in with the owner email/password
from your seed file.

Optional: set `FORCE_MOCK_TRANSPORT=false` in `config/deploy.local.env`, re-run
`pnpm deploy:configure`, then `pnpm deploy:api` after Email Sending is onboarded
(see below).

### 7. Inbound email (Email Routing → Worker)

```bash
cd workers/email-receiver
pnpm exec wrangler secret put INGEST_HMAC_SECRET --config wrangler.deploy.jsonc
# same value as API
cd ../..
pnpm deploy:email-receiver
```

In `config/deploy.local.env` you can enable Gmail (or other) copies:

```bash
FORWARD_BACKUP_ENABLED=true
FORWARD_BACKUP_ADDRESSES=you@gmail.com,backup@example.com
```

Those addresses must be **verified destinations** in Email Routing. Re-run
`pnpm deploy:configure` then `pnpm deploy:email-receiver` after changing them.

Dashboard → **Email Routing** → rule for your mailbox address → **Send to a Worker**
→ `your-flare-mails-email-receiver` (replace any Gmail-only forwarder Worker).

Forwarding is best-effort and runs before ingest; if a forward fails, the message
is still stored in YourFlareMails when ingest succeeds.

### 8. Outbound email (paid)

1. Upgrade to **Workers Paid** if needed.
2. Dashboard → **Email Service** → **Email Sending** → onboard your mail domain
   (leave subdomain blank for apex addresses like `hello@example.com`).
3. Set `FORCE_MOCK_TRANSPORT=false` in `config/deploy.local.env`.
4. `pnpm deploy:configure && pnpm deploy:api`
5. Send a test from the UI.

## Local development (no domain required)

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev:api    # :8787
pnpm dev:web    # :3000
```

Login: `owner@example.com` / `owner-dev-password`  
Details: [local-development.md](./local-development.md).

Optional local secret overrides: copy `workers/api/.dev.vars.example` →
`workers/api/.dev.vars`.

## Command cheat sheet

| Command | Purpose |
| --- | --- |
| `pnpm deploy:configure` | Build gitignored wrangler.deploy.jsonc from deploy.local.env |
| `pnpm deploy:api` | Deploy API Worker |
| `pnpm deploy:web` | Build Nuxt (prod API URL) + deploy web Worker |
| `pnpm deploy:email-receiver` | Deploy inbound Email Worker |
| `pnpm db:migrate:remote` | Apply D1 migrations to remote DB |
| `pnpm db:seed:remote` | Run `infra/seed/seed-prod.sql` on remote |
| `pnpm --filter @your-flare-mails/infra run hash-password -- '…'` | PBKDF2 hash for seed SQL |

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Login `internal_error` / PBKDF2 iteration error | Password hash must use ≤100k iterations (`hash-password` script) |
| UI calls `127.0.0.1:8787` | Rebuild web after `deploy:configure` (`NUXT_PUBLIC_API_BASE_URL`) |
| Send: `Message-ID` header not allowed | Fixed in transport; redeploy API if on old build |
| Send fails / plan error | Workers Paid + Email Sending domain onboarded |
| Inbound never appears | Email Routing still forwarding to Gmail; point at email-receiver |
| Nested subdomain SSL fails | Prefer `api.example.com` not `api.mail.example.com` (Universal SSL) |
