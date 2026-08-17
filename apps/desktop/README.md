# `@your-flare-mails/desktop`

Tauri 2 shell that loads the **YourFlareMails** Nuxt reference app (`apps/web`).

## Features (Phase 9–10)

- Desktop window wrapping `apps/web` (dev: Nuxt on `:3000`; release: static generate)
- OS notifications via `@tauri-apps/plugin-notification` on realtime events
- Session token + CSRF stored in the **OS keychain** (`keyring` crate commands)
- System tray (desktop only): show window / quit; close-to-tray
- Mobile (iOS/Android) via `tauri android|ios` + remote push (`tauri-plugin-mobile-push`)

## Prerequisites

- Rust toolchain (`rustc` / `cargo`)
- Platform deps for Tauri: https://v2.tauri.app/start/prerequisites/
- Local API: `pnpm dev:api` on `:8787`
- Android: SDK/NDK + Firebase `google-services.json` for release push (see [docs/mobile.md](../../docs/mobile.md))

## Develop

```bash
# terminal 1
pnpm dev:api

# terminal 2 — starts Nuxt then opens the Tauri window
pnpm dev:desktop

# or Android device/emulator
pnpm dev:android
```

Sign in with the seed user (`owner@example.com` / `owner-dev-password`).

## Build

```bash
# Desktop installers
pnpm --filter @your-flare-mails/desktop build

# Production Android APK (uses apps/web/.env.production.local API URL)
pnpm deploy:configure   # once / when hostnames change
pnpm build:android
```

`beforeBuildCommand` runs `build:desktop`, which bakes the production API base URL
into the SPA (same source as web deploy).

## Notes

- Mobile push / APK checklist: [docs/mobile.md](../../docs/mobile.md)
- Web Push / VAPID browser delivery can reuse Device `push_keys_json` later
