# Web UI

The reference app (`apps/web`) is a Nuxt 3 application that dogfoods:

- `@your-flare-mails/nuxt` — composables + runtime config
- `@your-flare-mails/ui` — replaceable primitives
- `@your-flare-mails/theme` — CSS tokens (light/dark)
- `@your-flare-mails/api-client` — typed HTTP client

## Local run

```bash
pnpm db:migrate && pnpm db:seed
pnpm dev:api    # :8787 mailbox + ingest API
pnpm dev:web    # :3000 Nuxt UI → http://127.0.0.1:3000/login
```

Sign in with the seed user:

- Email: `owner@example.com`
- Password: `owner-dev-password`

The API client uses `Authorization: Bearer <sessionToken>` (and optional cookies).
See [auth.md](./auth.md).

## Phase 5–7 capabilities

- Browse labels, threads, and messages
- **Search** via `SearchBar` + `useMailSearch()` (FTS5 BM25)
- **Attachment download** from `MessageViewer` (signed URL → private R2)
- **Compose / reply / forward** via `Composer` + `useCompose()` with autosave
- **Send** through `POST /api/drafts/:id/send` (`MockMailTransport` locally)
- **Draft attachment upload** on the Drafts label
- **Realtime** via `useRealtimeMailbox()` (WebSocket + poll fallback; see
  [realtime.md](./realtime.md))
- **Auth** via `useAuth()` + `/login` (sessions; see [auth.md](./auth.md))

HTML bodies (when present) render in an iframe with `sandbox=""` (no scripts /
same-origin). Plain text is preferred when only text is available.

## Custom UI

Skip `@your-flare-mails/ui` / `@your-flare-mails/theme` and use only the Nuxt
composables (`useAuth`, `useMailbox`, `useThreadList`, `useThread`, `useMessage`,
`useMailSearch`, `useRealtimeMailbox`) against the same API.
