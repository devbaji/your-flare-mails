# YourFlareMails

Open-source, Cloudflare-native framework and reference application for running a
real, self-hosted email mailbox on a domain you manage through Cloudflare
(e.g. `hello@example.com`).

## Status

**Phase 9 — Desktop.** Tauri 2 shell wrapping `apps/web`, OS notifications on
realtime events, OS keychain session storage, and system tray basics. See
[docs/desktop.md](./docs/desktop.md).

## Monorepo map

```
apps/
  web/                 # Nuxt reference app (Phase 4–5)
  desktop/             # Tauri 2 shell (Phase 9)
packages/
  core/                # Domain model (no Cloudflare/Vue)
  cloudflare/          # D1, R2, DO, transports
  server/              # Framework server services
  nuxt/                # Nuxt module + composables
  ui/                  # Theme-agnostic Vue primitives
  theme/               # Default visual tokens
  api-client/          # Typed HTTP client
  types/               # Shared TypeScript types
workers/
  email-receiver/      # Inbound Email Worker (Phase 2)
examples/
  default-mail/        # Compose packages without the default theme
docs/                  # Architecture and deployment docs
infra/                 # Wrangler configs + D1 migrations (Phase 1+)
tooling/               # Shared TS / ESLint / Vitest config
```

## Requirements

- Node.js 22+
- [pnpm](https://pnpm.io) 10+

## Local development

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm fixtures:check
pnpm typecheck
pnpm lint
pnpm test
```

You do not need a real domain for local development. Details:
[docs/local-development.md](./docs/local-development.md).

## Documentation

See [docs/](./docs/README.md). Product and roadmap: [CURSOR_MASTER_PROMPT.md](./CURSOR_MASTER_PROMPT.md).

## License

[MIT](./LICENSE)
