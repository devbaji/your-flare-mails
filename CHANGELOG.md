# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Phase 2 inbound pipeline: `postal-mime` normalization, HMAC-signed
  `POST /api/inbound/email`, nonce replay protection, fingerprint idempotency,
  basic `In-Reply-To`/`References` threading, `workers/api` + `workers/email-receiver`,
  and `pnpm ingest:fixture`.
- Phase 1 core domain model: Zod entity schemas, message fingerprint helper,
  `MailTransport` / `MockMailTransport`, and `BODY_INLINE_MAX_BYTES` (8 KiB).
- Local D1 schema (`infra/migrations/0001_init.sql`) with FTS5 + sync triggers,
  Wrangler D1/R2 config, idempotent seed (`hello@example.com`), and MIME fixtures.
- Docs: [docs/local-development.md](./docs/local-development.md); architecture
  storage notes updated.
- Phase 0 monorepo foundation: pnpm workspaces, shared TypeScript/ESLint/Vitest
  tooling, empty-but-wired packages/apps/workers, open-source docs stubs, and CI.
