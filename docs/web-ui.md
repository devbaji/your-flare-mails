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
pnpm dev:web    # :3000 Nuxt UI
```

Temporary identity (Phase 8 replaces this):

- `NUXT_PUBLIC_YFM_USER_ID=user_seed_owner` (default)
- `NUXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787` (default)

## Phase 5–6 capabilities

- Browse labels, threads, and messages
- **Search** via `SearchBar` + `useMailSearch()` (FTS5 BM25)
- **Attachment download** from `MessageViewer` (signed URL → private R2)
- **Compose / reply / forward** via `Composer` + `useCompose()` with autosave
- **Send** through `POST /api/drafts/:id/send` (`MockMailTransport` locally)
- **Draft attachment upload** on the Drafts label

HTML bodies (when present) render in an iframe with `sandbox=""` (no scripts /
same-origin). Plain text is preferred when only text is available.

## Custom UI

Skip `@your-flare-mails/ui` / `@your-flare-mails/theme` and use only the Nuxt
composables (`useMailbox`, `useThreadList`, `useThread`, `useMessage`,
`useMailSearch`) against the same API.
