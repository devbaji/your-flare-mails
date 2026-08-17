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

## Mail UI (Gmail-like shell)

- **Folders:** Inbox, Sent, Drafts, Archive, Trash (system labels only; Spam stays in the data model but is hidden from nav)
- **Compose:** floating bottom-right panel with TipTap rich text; drafts persist `bodyHtml` + plain `bodyText` via `useCompose()` / `useDraft()`
- **Drafts:** list from `listDrafts`; row click opens the floating composer (`openExisting`)
- **Folder actions:** Archive / Trash / Move to Inbox via `POST /api/threads/:id/{archive|trash|inbox}`
- **Reading pane:** HTML bodies render in a sandboxed iframe when `bodyHtml` is available; plain text otherwise
- **Attachments:** clearer chips in the reader; draft attachments attach from the composer
- **Responsive:** under ~960px, list and reader are separate panes with a Back control; sidebar collapses to icons + compose FAB
- **Theme:** sun/moon toggle in the shell bar; preference stored in `localStorage` (`yfm-color-mode`) + `html.dark`

Also:

- **Search** via `SearchBar` + `useMailSearch()` (FTS5 BM25)
- **Realtime** via `useRealtimeMailbox()` (WebSocket + poll fallback; see [realtime.md](./realtime.md))
- **Auth** via `useAuth()` + `/login` (sessions; see [auth.md](./auth.md))

## Custom UI

Skip `@your-flare-mails/ui` / `@your-flare-mails/theme` and use only the Nuxt
composables (`useAuth`, `useMailbox`, `useThreadList`, `useThread`, `useMessage`,
`useMailSearch`, `useRealtimeMailbox`, `useCompose`) against the same API.
