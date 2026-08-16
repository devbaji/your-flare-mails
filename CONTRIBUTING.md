# Contributing to YourFlareMails

Thanks for your interest in contributing.

## Development setup

1. Install Node.js 22+ and pnpm 10+.
2. Clone the repository and run `pnpm install` from the root.
3. Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` before opening a PR.

## Guidelines

- Follow the phased roadmap in `CURSOR_MASTER_PROMPT.md`. Do not land email
  features in packages that are still stubs for an earlier phase without
  updating docs and tests for that phase.
- Keep `packages/core` free of Vue, Nuxt, and Cloudflare SDK imports.
- Keep `packages/theme` free of `packages/core` internals.
- Prefer extending working code over rewriting it.
- Never commit secrets (`.env`, API tokens, HMAC keys, credentials).
- Treat all inbound email content as untrusted when you touch MIME/HTML paths.

## Pull requests

- Keep PRs focused on one coherent change.
- Include tests for new behavior.
- Update `docs/` when you make non-obvious architectural decisions.
- Update `CHANGELOG.md` under Unreleased when user-facing behavior changes.

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
