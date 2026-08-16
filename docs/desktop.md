# Desktop app (Phase 9)

Tauri 2 shell in `apps/desktop` wraps the Nuxt reference UI (`apps/web`).

## Architecture

```
pnpm dev:desktop
  → starts apps/web (Nuxt :3000)
  → Tauri webview loads http://127.0.0.1:3000
  → API calls go to workers/api (:8787) with Bearer session
  → realtime events → useNotifications() → OS toast (while running)
  → session token persisted via Rust keyring commands (OS keychain)
```

Release builds use `YFM_DESKTOP=1 nuxt generate` (static SPA) as `frontendDist`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev:api` | Mailbox API |
| `pnpm dev:desktop` | Tauri + Nuxt |
| `pnpm --filter @your-flare-mails/desktop build` | Native installer |

## Secure session storage

Commands: `secret_set` / `secret_get` / `secret_delete` (service
`com.yourflaremails.desktop`). Used by `useAuth()` only when `isTauri()` is true.
Browser sessions stay in memory + cookie/Bearer as in Phase 8.

## Tray / lifecycle

- Close main window → hide to tray (does not quit)
- Tray menu: **Show YourFlareMails**, **Quit**
- Left-click tray icon → show + focus

## Out of scope (later)

- Phase 10: iOS/Android + remote push
- Full `notificationService` / Web Push VAPID backend
