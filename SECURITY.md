# Security Policy

## Supported versions

YourFlareMails is pre-release. Security fixes target the `main` branch until the
first tagged release.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email a private report to the maintainers (replace with a dedicated security
contact once published), including:

- Description of the issue and affected packages/paths
- Steps to reproduce or a proof of concept
- Impact assessment if known

We will acknowledge receipt within a few business days and coordinate a fix and
disclosure timeline.

## Scope notes

Particularly sensitive areas for this project:

- Inbound MIME parsing and HTML sanitization / iframe sandboxing
- Ingestion HMAC verification and replay protection
- Attachment storage (private R2) and signed URL issuance
- Authentication, session handling, and mailbox authorization
- Secrets (HMAC keys, VAPID keys, transport credentials) never belonging in clients

See `docs/architecture.md` and `CURSOR_MASTER_PROMPT.md` §15 for the security
model we are building toward.
