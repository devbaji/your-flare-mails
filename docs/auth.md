# Authentication & authorization (Phase 8)

Self-hosted multi-user auth is **session-based**. Cloudflare Access is an
optional alternate for personal deployments behind Access.

## Modes

| Mode | How identity is established |
| --- | --- |
| Session (default) | `POST /api/auth/login` → HttpOnly `yfm_session` cookie + returned Bearer token |
| Cloudflare Access | Verify `Cf-Access-Jwt-Assertion` when `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` are set |
| Dev header | Only when `ALLOW_DEV_USER_HEADER=true` — spoofable; local emergency only |

Authorization is unchanged in spirit: every mailbox-scoped service call must
receive `AuthContext` and call `requireMailboxAccess` (or load a resource that
already did). Clients never supply a trusted `userId`.

## Local login

After `pnpm db:migrate && pnpm db:seed`:

- Email: `owner@example.com`
- Password: `owner-dev-password`

```bash
curl -s -X POST http://127.0.0.1:8787/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"owner@example.com","password":"owner-dev-password"}'
```

Use the returned `sessionToken` as `Authorization: Bearer …` for API calls
(recommended for local Nuxt `:3000` → API `:8787` split origin). Same-origin
deployments can rely on the `yfm_session` cookie alone.

## CSRF

Cookie-authenticated `POST`/`PATCH`/`DELETE` requests must send
`x-yfm-csrf: <csrfToken>` matching the session. Bearer auth skips CSRF.

## Rate limits (D1 fixed window)

| Endpoint | Limit |
| --- | --- |
| `POST /api/auth/login` | 20/min per IP, 10/min per email |
| `POST /api/inbound/email` | 120/min per IP |

## Cloudflare Access (personal)

1. Put the app hostname behind an Access application.
2. Set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` on `workers/api`.
3. Provision a matching local `users.email` row (Access does not create users).
4. Prefer Access for single-operator personal boxes; use sessions for multi-user.

JWT verification uses team JWKS + RS256 via Web Crypto (no extra JWT dependency).

## Ingest signing (production hardening)

MVP continues to use HMAC-SHA256 + timestamp skew + nonce replay protection
(`INGEST_HMAC_SECRET`). Production recommendations:

1. Use a **dedicated** ingest secret — never share with `BLOB_SIGNING_SECRET`.
2. Restrict ingest to the email-receiver Worker (network / mTLS / service tokens)
   in addition to HMAC.
3. Prefer Cloudflare Access service tokens or Workers service bindings for
   Worker→Worker calls when available in your account topology.
4. Rotate secrets regularly; dual-secret verification can be added later without
   schema changes.

See also [inbound-email.md](./inbound-email.md).

## Routes

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/auth/login` | public (rate limited) |
| POST | `/api/auth/logout` | session optional |
| GET | `/api/auth/me` | session / Access |
| * | other `/api/*` mailbox routes | session / Access |
