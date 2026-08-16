# `@your-flare-mails/desktop`

Tauri 2 shell that loads the **YourFlareMails** Nuxt reference app (`apps/web`).

## Features (Phase 9–10)

- Desktop window wrapping `apps/web` (dev: Nuxt on `:3000`; release: static generate)
- OS notifications via `@tauri-apps/plugin-notification` on realtime events
- Session token + CSRF stored in the **OS keychain** (`keyring` crate commands)
- System tray: show window / quit; close-to-tray
- Mobile (iOS/Android) via `tauri android|ios` + remote push (`tauri-plugin-mobile-push`)

## Prerequisites

- Rust toolchain (`rustc` / `cargo`)
- Platform deps for Tauri: https://v2.tauri.app/start/prerequisites/
- Local API: `pnpm dev:api` on `:8787`

## Develop

```bash
# terminal 1
pnpm dev:api

# terminal 2 — starts Nuxt then opens the Tauri window
pnpm dev:desktop
```

Sign in with the seed user (`owner@example.com` / `owner-dev-password`).

## Build

```bash
pnpm --filter @your-flare-mails/desktop build
```

Runs `YFM_DESKTOP=1 nuxt generate` then `tauri build`.

## Notes

- Mobile push setup: [docs/mobile.md](../../docs/mobile.md)
- Web Push / VAPID browser delivery can reuse Device `push_keys_json` later
