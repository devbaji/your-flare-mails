# CURSOR MASTER PROMPT — YourFlareMails

You are building **YourFlareMails** (repository: `your-flare-mails`): an open-source, Cloudflare-native framework and reference application for running a real, self-hosted email mailbox on a domain the user manages through Cloudflare (e.g. `hello@example.com`), with Web, Desktop, and Mobile clients, and a customizable UI/component system on top — analogous to how Nuxt relates to Vue apps, or VitePress relates to documentation sites.

Read this entire document before writing any code. It defines the product, the architecture, the repository layout, the security model, and a phased implementation plan. You must follow the phased plan — **do not attempt to build everything in one pass.**

---

## 1. What we are building and why

### 1.1 Product

A developer who owns a domain, manages it on Cloudflare DNS, and has Cloudflare Email Routing available should be able to deploy YourFlareMails to their own Cloudflare account and get a fully functional mailbox for addresses on that domain (e.g. `hello@example.com`), without depending on Gmail "send mail as" or any third-party mail provider. The mailbox is usable from a web app, a desktop app, and mobile apps, and supports inbound mail, outbound mail, attachments, threads, search, drafts, labels, notifications, contacts, and settings.

### 1.2 Positioning: framework, not a single app

YourFlareMails is **not** a hard-coded Gmail clone. It is a framework for building email applications on Cloudflare, with a polished default application (the "reference app") that dogfoods the framework's own public APIs. A developer must be able to:

- Use the default UI as-is.
- Replace individual components (sidebar, message list, composer, etc.) while keeping the rest.
- Build a completely custom UI using only the framework's composables/services, without touching the default theme.

Four layers must remain decoupled:

1. **Core** — email domain model, Cloudflare integration, storage, ingestion, sending, threading, search. No UI dependency at all.
2. **Framework APIs** — composables and server services that a Nuxt app calls. Framework-aware, UI-agnostic.
3. **UI primitives** — unstyled/lightly-styled Vue components (layout, list, viewer, composer, pickers) built on the framework APIs. Themeable, replaceable, usable independently of the default theme.
4. **Default theme/reference app** — the actual shipped email client, built by composing layer 3 and layer 2. This is what most users run without modification, and it is also the proof that layers 1–3 are sufficient on their own.

Do not let layer 4 leak private implementation details into layers 1–3. Do not let layer 1 import anything from Vue/Nuxt.

### 1.3 Cloudflare is the platform, not "a provider"

This project intentionally does not attempt multi-cloud portability. Do not introduce AWS, Vercel, Supabase, or Firebase as required dependencies anywhere in the core or default app. External services may only appear as clearly optional, swappable extension points (e.g. an alternate `MailTransport` a developer could implement themselves), never as something the default deployment needs.

---

## 2. Current Cloudflare platform facts you must design against

These were verified against current Cloudflare documentation. Do not assume older architectures (e.g. MailChannels-based sending, Cloudflare Pages Functions as the deployment target, D1 without FTS5) are still correct — verify against `developers.cloudflare.com` yourself before implementing if anything here seems ambiguous, since the platform continues to evolve.

- **Cloudflare Email Service** is the unified product covering both inbound (**Email Routing**, free/paid) and outbound (**Email Sending**, Workers Paid plan) email. A single Worker can hold both a `send_email` binding (outbound) and an `email()` handler (inbound).
  - Outbound: add a `send_email` binding in `wrangler.jsonc`, call `env.EMAIL.send({...})`. Sending can be restricted per-binding to specific sender/recipient addresses via `allowed_sender_addresses` / `allowed_destination_addresses` / `destination_address`.
  - Inbound: an Email Routing rule directs mail for the zone to a Worker, which implements the `email(message, env, ctx)` handler.
  - Local dev: `wrangler dev` **simulates** the email binding by default (emails are logged, not sent). Use `remote: true` on the binding only when you deliberately want real sends during local development, and always route real sends to test addresses in that mode.
  - Domains must be onboarded to Email Service (SPF/DKIM DNS records) before outbound sending works; this is separate from just having Email Routing configured.
- **Nitro's `cloudflare_module` preset** (Cloudflare Workers, module syntax) is the current recommended deployment target for Nuxt on Cloudflare — not `cloudflare-pages`. Module workers give direct binding access to D1, R2, Queues, and Durable Objects from the same deployable unit. Only fall back to a Pages-specific preset if you hit a concrete Workers Module limitation, and document why.
- **D1** is SQLite-compatible and supports the **FTS5** virtual-table module (including BM25 ranking) — use it for mailbox search instead of introducing an external search service. As of early 2026, D1 does not support ad-hoc multi-statement interactive transactions (`BEGIN`/`COMMIT` across separate round-trips); use D1's atomic `batch()` API for multi-statement writes that must be atomic, and SQLite triggers (which D1 does support, being real SQLite) to keep an FTS5 shadow table automatically in sync with the base `messages` table on insert/update/delete, rather than relying on the client transaction to do it.
- **R2** is for large/binary content: raw MIME, attachments, inline images. Do not put attachment bytes or full raw MIME in D1; store references (R2 object key, size, content-type, checksum) in D1 and the bytes in R2.
- **Durable Objects with the WebSocket Hibernation API** are the correct primitive for realtime mailbox updates. Use `webSocketMessage`/`webSocketClose`/`webSocketError` handlers (not the plain event-listener WebSocket API), `serializeAttachment`/`deserializeAttachment` for per-connection state, and one Durable Object **per mailbox** (not a single global object) so hot mailboxes don't bottleneck others. Hibernation means the object can be evicted from memory while clients stay connected to Cloudflare's edge, and billable duration does not accrue while hibernating — do not avoid Durable Objects here on cost grounds; do avoid using them for anything that isn't genuinely stateful/coordinated (e.g. do not put the whole REST API inside a Durable Object).
- **Queues** should sit between the inbound Email Worker and the heavier processing/persistence step if/when message volume or processing time makes synchronous handling risky (large MIME parsing, many attachments). Start synchronous in early phases; introduce a Queue only when a concrete limit is hit, and document the decision when you do.
- **Tauri 2** has stable desktop (macOS/Windows/Linux) and mobile (iOS/Android) support from one codebase, using WKWebView on iOS and Android WebView. Tauri core does **not** provide built-in APNs/FCM remote push registration — that requires a dedicated mobile push plugin. Design the notification abstraction so this is swappable rather than hard-wired to one plugin's API.

---

## 3. Monorepo structure

```
your-flare-mails/
  apps/
    web/                    # Nuxt app — the reference application (dogfoods packages/*)
    desktop/                # Tauri 2 shell wrapping apps/web's built output
  packages/
    core/                   # Domain model, types, zod schemas. No Cloudflare/Vue/Nuxt imports.
    cloudflare/             # D1 repositories, R2 client wrappers, DO classes, MIME parsing, MailTransport impl
    server/                 # Framework server services (mailboxService, messageService, etc.), Nitro-agnostic where possible
    nuxt/                   # Nuxt module: registers composables, server routes, runtime config, auto-imports
    ui/                     # Vue UI primitives (MailLayout, MessageList, Composer, ...), theme-agnostic
    theme/                  # Default visual theme/tokens consumed by ui/ and apps/web
    api-client/             # Typed client for the HTTP API, shared by web + desktop + (future) mobile
    types/                  # Shared TypeScript types/interfaces generated from or hand-aligned with core
  workers/
    email-receiver/         # Standalone Worker: Cloudflare email() handler -> normalizes MIME -> POSTs to backend
  examples/
    default-mail/           # Minimal example proving packages/* can be composed without apps/web's theme
  docs/                     # Architecture docs, deployment docs, Cloudflare setup, env var reference
  infra/                    # wrangler.jsonc(s), D1 migrations, Terraform/scripts if introduced later
  tooling/                  # eslint/tsconfig/vitest shared config, scripts
  README.md
  LICENSE
  CONTRIBUTING.md
  SECURITY.md
  CODE_OF_CONDUCT.md
  CHANGELOG.md
```

Adjust this if implementation reveals a boundary is wrong, but do not create new top-level packages casually — justify each one against "does this have a genuinely different consumer/lifecycle than its neighbors?"

---

## 4. Email domain model

Core entities (design the actual schema; this is the conceptual shape, not a literal DDL to copy verbatim):

- **Domain** — a Cloudflare zone the deployment is configured for.
- **Mailbox** — an address on a domain (`hello@example.com`), belongs to a domain, has one or more owning **User**s (supports future multi-user).
- **Thread** — a conversation, derived from `Message-ID`/`In-Reply-To`/`References`, with a documented fallback for messages missing those headers.
- **Message** — a single email, belongs to a thread and a mailbox; stores normalized headers (`Message-ID`, `From`, `To`, `Cc`, `Bcc` where available, `Reply-To`, `Subject`, `Date`, `In-Reply-To`, `References`), plain-text body, sanitized-HTML reference, raw-MIME reference (R2), direction (inbound/outbound), and a **fingerprint** for idempotency.
- **Attachment** — metadata in D1 (filename, content-type, size, checksum, R2 key), bytes in R2, treated as untrusted.
- **Label** — user-defined or system labels (e.g. inbox, sent, drafts, archive, trash), many-to-many with messages/threads.
- **Draft** — an in-progress outbound message, not yet sent.
- **Contact** — derived/managed address book entries.
- **Device** — registered client (web push subscription, desktop, mobile) for notification delivery.
- **NotificationSubscription** — links a Device to a Mailbox for push delivery.
- **Account/User** — auth identity; a Mailbox can have more than one User in future multi-user deployments.
- **Settings** — per-mailbox and per-user configuration.

Use D1 migrations (plain `.sql` files under a `migrations/` directory, applied via `wrangler d1 migrations apply`) for every schema change from the very first table onward. Add indexes deliberately (at minimum: `messages(thread_id)`, `messages(mailbox_id, date)`, `messages(message_id_header)` for idempotency lookups, and the FTS5 virtual table + its sync triggers).

---

## 5. Inbound email architecture

```
Internet
  -> Cloudflare Email Routing (rule on the zone)
  -> Cloudflare Email Worker (workers/email-receiver)
       - reads the raw message stream
       - parses MIME with a mature parser (postal-mime, or current best-practice equivalent — verify it is still maintained before adopting)
       - extracts: Message-ID, From, To, Cc, Bcc (where available), Reply-To, Subject, Date,
         plain text, HTML, attachments, inline images, In-Reply-To, References
       - computes a deterministic fingerprint (e.g. hash of Message-ID + envelope recipients,
         falling back to a content hash when Message-ID is absent/untrustworthy)
       - optionally forwards a copy to a configured backup/migration destination address
         via the same send_email binding (see §7)
       - signs a request (HMAC, see §9) and POSTs the normalized payload to the backend:
         POST /api/inbound/email
  -> Application backend (Nitro server route)
       - verifies the HMAC signature + timestamp + replay protection
       - idempotency check against Message-ID/fingerprint — duplicate delivery must not create a duplicate Message row
       - resolves/creates the Thread via In-Reply-To/References, falling back sensibly when absent
       - persists Message metadata to D1, raw MIME + attachments to R2
       - triggers realtime fan-out (Durable Object, §11) and notification dispatch (§12)
  -> Web/Desktop/Mobile clients
```

The email Worker must be resilient to malformed/hostile MIME: wrap parsing in error handling, cap message/attachment sizes, and never let a single malformed message crash processing of subsequent messages.

---

## 6. Outbound email architecture

```
Web/Tauri app (never holds send credentials)
  -> authenticated backend API (POST /api/messages/send or similar)
       - authorizes the caller against the target mailbox
       - validates recipients/body (zod)
       - persists the outbound Message (status: sending)
  -> MailTransport abstraction
  -> CloudflareEmailTransport implementation (send_email binding, env.EMAIL.send(...))
  -> Cloudflare Email Service
  -> Internet
```

Define a small `MailTransport` interface in `packages/core` (e.g. `send(message): Promise<SendResult>`), with `CloudflareEmailTransport` in `packages/cloudflare` as the only v1 implementation, plus a `MockMailTransport` for local dev/tests. Do not build support for multiple external outbound providers in v1 — this is an extension point, not a v1 feature.

The frontend must never receive or hold any credential capable of sending mail; it only calls the authenticated backend API.

---

## 7. Forwarding / migration safety

The inbound Email Worker may optionally forward a copy of each inbound message to a configured backup address, using the same `send_email` binding, controlled by a deployment-level setting. This exists purely for migration/backup during cutover from an existing provider (e.g. Gmail) and must default to **off**. The application mailbox is always the primary, authoritative mailbox — forwarding is never a substitute for it and must not be required for the app to function.

---

## 8. Storage model

- **D1**: users, accounts, domains, mailboxes, threads, messages (metadata + small text bodies where reasonable), recipients, labels, drafts, contacts, devices, notification subscriptions, attachment metadata, settings, FTS5 virtual table(s) for search.
- **R2**: attachments, inline images, raw MIME, and any message body content large enough that storing it in D1 would be wasteful (define and document a concrete size threshold, e.g. bodies over a few KB move to R2 with a D1 pointer). Attachments live in a **private** bucket; access is via short-lived signed URLs issued by the backend after authorization, never via public bucket URLs.
- Use migrations for every schema change (§4). Design indexes around the actual query patterns you implement (thread view, mailbox list, search) rather than adding indexes speculatively.

---

## 9. Ingestion authentication (Worker -> backend)

The `POST /api/inbound/email` endpoint must be authenticated with:

- A shared secret used to compute an **HMAC** signature over the request body.
- A **timestamp** included in the signed payload, rejected if outside an acceptable window (e.g. 5 minutes) to bound replay risk.
- A **nonce or fingerprint-based replay check** so a captured, valid, in-window request cannot be replayed to create duplicate effects (this also doubles as part of the idempotency mechanism in §5).
- **Constant-time comparison** for the signature check (never `===` on secrets/signatures).

A single shared secret is acceptable for the MVP (Phase 2); document in `docs/` that a stronger signed-request mechanism (e.g. asymmetric signing, or Cloudflare-native request verification if a suitable primitive exists) is the recommended production hardening path, and revisit it in the security-hardening phase (§14, Phase 8) rather than leaving it purely aspirational.

---

## 10. Framework APIs

### 10.1 Client composables (packages/nuxt, consumed via Nuxt auto-import)

Design the real API surface during implementation; use these as a starting point, not a mandate:

- `useMailbox()` — current mailbox context, mailbox list/switching.
- `useThreadList(mailboxId, filters)` — paginated/reactive thread list for a mailbox view.
- `useThread(threadId)` — a single thread's messages, reactive.
- `useMessage(messageId)` — a single message.
- `useCompose()` — compose/reply/forward state and submission.
- `useDraft(draftId?)` — draft CRUD with autosave.
- `useMailSearch()` — search query state + results.
- `useContacts()` — contact list/lookup.
- `useLabels()` — label CRUD and assignment.
- `useNotifications()` — subscribe/unsubscribe current device, notification permission state.
- `useRealtimeMailbox(mailboxId)` — underlying realtime connection (§11), used internally by the above but exposed for custom UIs.

### 10.2 Server services (packages/server, called from Nitro routes)

- `mailboxService`, `messageService`, `threadService`, `draftService`, `attachmentService`, `searchService`, `notificationService`, `contactService`, `labelService`, `authService`.

Every service function must take an authenticated/authorized context (never a bare client-supplied ID with implicit trust — see §13) and return typed results defined in `packages/types`. Business logic lives here, not in Nuxt server route handlers (routes should be thin: parse/validate input, call a service, shape the response) and not in Vue components.

---

## 11. Realtime

- Each Mailbox has an associated **Durable Object** ("MailboxRealtime" or similar) using the **WebSocket Hibernation API**.
- Clients open a WebSocket to a Nitro route that forwards the Upgrade request to the mailbox's Durable Object instance (looked up via `idFromName(mailboxId)`).
- On new message ingestion (§5) or state change (label applied, message read, etc.), the backend notifies the relevant Durable Object (via RPC/binding call), which fans the event out to connected WebSocket clients using `serializeAttachment`/`deserializeAttachment` for per-connection identity.
- Provide a **Server-Sent Events or polling fallback** for environments where WebSockets aren't viable (define this fallback explicitly rather than leaving clients with no realtime path).
- Do not introduce Durable Objects anywhere else in the system merely because they're available — this is their one clear use case here (mailbox-scoped realtime coordination).

---

## 12. Notifications

- **Web (browser)**: standard Web Push (VAPID) subscription registered via `useNotifications()`, delivered when the backend detects a relevant event.
- **Desktop (Tauri)**: local OS notifications via Tauri's notification plugin when the app is foregrounded/running and a realtime event arrives; do not attempt to keep a permanent open WebSocket as the sole mobile background strategy (explicitly disallowed by the product brief and impractical on iOS/Android background limits regardless).
- **Mobile (Tauri iOS/Android)**: remote push via APNs/FCM through a dedicated Tauri mobile push plugin (Tauri core does not provide this itself — pick and document a specific, actively maintained plugin at implementation time, since this ecosystem moves fast). The backend sends to APNs/FCM directly (or via the plugin's companion service if it requires one) when a push-registered device should be notified.
- Expose a single `notificationService`/`useNotifications()` abstraction to the rest of the framework so callers don't need to know which transport (Web Push vs APNs vs FCM) is in play for a given device — resolve that internally from the `Device` record.

---

## 13. Authentication & authorization

- Design for a **self-hosted, potentially multi-user** deployment. Do not hard-require Cloudflare Access, since that would block normal multi-user deployments where Access isn't configured, but do document Cloudflare Access as a supported/recommended option for simple personal deployments (put the zone behind Access; the app can trust the Access-asserted identity when present).
- For the general case, implement session-based auth appropriate for Nuxt on Workers (research current, actively maintained options compatible with the Nitro/Workers runtime rather than assuming a Node-only library works — verify runtime compatibility before adopting a dependency).
- Enforce on every request:
  - **Authentication** — who is calling.
  - **Authorization** — does this identity have access to the requested Mailbox/Thread/Message/Attachment.
  - **Tenant/mailbox isolation** — never trust a client-supplied `mailboxId`/`threadId`/etc. without verifying the authenticated identity actually owns/has access to it, on every service call, every time.

---

## 14. Multi-user / multi-mailbox / multi-domain

The schema (§4) must not preclude, later:

- Multiple Domains per deployment.
- Multiple Mailboxes per Domain (`hello@`, `support@`, `sales@`).
- Multiple Users per Mailbox, and a User belonging to multiple Mailboxes.
- Aliases resolving to a Mailbox.

Do not build enterprise multi-tenant billing/organization machinery in v1 — just don't paint the data model into a single-mailbox corner (e.g. don't hang core tables directly off a singleton "the deployment" concept).

---

## 15. Security requirements (apply throughout, not just one phase)

- Treat all inbound email content — headers, body, HTML, attachments — as **untrusted and potentially hostile**.
- **Never render inbound HTML in the privileged application context.** Render it inside a sandboxed iframe (`sandbox` attribute, no `allow-same-origin` + `allow-scripts` together, strip/neutralize `<script>`, event handlers, and remote-tracking-prone content per a documented sanitization pass) so it cannot execute JavaScript, read cookies/localStorage, call Tauri APIs, or manipulate the parent page. Document the exact sanitization + sandboxing approach in `docs/architecture.md` and cover it with tests (§18).
- Attachments are untrusted: store in a **private** R2 bucket, serve only via short-lived signed URLs issued after an authorization check, never a public bucket path.
- Never expose infrastructure secrets (HMAC secret, transport credentials, DB connection info) to any client.
- Never log email bodies, attachment contents, passwords, API tokens, or other secrets.
- Apply secure HTTP headers, CSRF protection on state-changing routes, and rate limiting on the ingestion endpoint and auth endpoints in particular.
- Defend against: inbound email floods, oversized messages/attachments, malformed/malicious MIME, duplicate delivery, malicious attachment payloads, unauthorized mailbox access, and replayed ingestion requests (§9).

---

## 16. Search

- Use a D1 **FTS5** virtual table indexing subject, plain-text body, sender, recipient(s) for each message, with BM25 ranking.
- Keep the FTS index in sync with the base `messages` table using SQLite triggers (insert/update/delete), not an application-level "remember to also update the index" convention, and not relying on multi-statement client transactions (D1 does not support those as of early 2026 — use `batch()` where atomicity across statements is required outside of trigger-driven consistency).
- Support filtering by sender, recipient, subject, free text, date range, unread state, labels, and has-attachment, composable with the FTS query.
- Do not introduce Elasticsearch/OpenSearch or any external search service.

---

## 17. Web framework & theming

- Vue 3 + Nuxt + TypeScript + Composition API, Nitro with the `cloudflare_module` preset (§2), Pinia where state genuinely needs a store (prefer composables + Nuxt's built-in state for anything simpler), Tailwind CSS, Zod for all input validation (client and server), VueUse where it removes boilerplate.
- Theming: a token-based system (colors, typography, spacing, borders, component variants) consumed by `packages/ui` and `packages/theme`, with light/dark mode built in from the start, not retrofitted.
- Branding configuration surface: name, logo, favicon, colors, default theme, navigation, mailbox label set — exposed as Nuxt module/runtime config so a developer can rebrand without forking.
- The default visual identity must be fully optional — a developer using only `packages/core` + `packages/server` + `packages/nuxt` (skipping `packages/ui`/`packages/theme` entirely) must still have a fully functional mailbox backend to build their own UI against.

---

## 18. Testing

- **Vitest** for unit/integration tests: MIME parsing, ingestion idempotency, HMAC verification, replay protection, threading logic, search, draft CRUD, attachment handling, authorization checks, HTML-email sandboxing behavior.
- **Playwright** for UI flows: send/receive round-trip against local dev infra, thread view, compose, search, responsive/mobile-viewport behavior.
- Build a realistic set of **email fixtures** (raw MIME files) covering: plain text only, HTML + plain text multipart, inline images, attachments, missing/malformed threading headers, malformed MIME, oversized messages, and known malicious-HTML patterns (script tags, event handlers, external tracking pixels) for sandboxing tests.
- Every feature phase must land with tests for that phase's behavior — do not defer testing to a later phase.

---

## 19. Local development experience

A developer must be able to clone the repo and run the reference app locally **without owning a real domain**:

- Local D1 (via Wrangler's local persistence) with a migration + seed script producing a realistic mailbox (multiple threads, varied message types, labels, a draft, contacts, attachments).
- Local R2 emulation via Wrangler.
- `MockMailTransport` for outbound sends in dev (logs instead of sending, unless a developer opts into `remote: true` bindings against real Email Service with test addresses).
- A way to inject a "fake inbound email" (a fixture MIME file) through the same ingestion path used in production, for realistic local testing of the full pipeline.
- Seed script must be idempotent and clearly documented.

---

## 20. CLI (design now, defer heavy implementation)

Concept: `npm create your-flare-mails` scaffolds a new deployment, prompting for project name, domain, Cloudflare account, mailbox address(es), storage config, auth mode, theme, and which clients (web/desktop/mobile) to enable. In early phases, implement only enough of this to scaffold config files correctly for a manual deployment — do not attempt automatic Cloudflare resource provisioning until Phase 11. Establish a solid, fully-documented **manual** deployment path first (§21) so the CLI has something correct to automate later.

---

## 21. Open source requirements

Include and keep current: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, plus `docs/` covering architecture, local development, Cloudflare setup (DNS, Email Routing, Email Service onboarding, D1/R2/Queues provisioning), deployment, and a full environment-variable reference. Use `example.com` and generic addresses (`hello@example.com`) everywhere — never a real personal domain or address. The project must be usable by a developer with zero knowledge of the original author's own deployment.

---

## 22. Phased implementation roadmap

Work through these phases **in order**, one at a time. For every phase:

1. Inspect the current repository state before changing anything — do not assume prior phases left things in a particular shape without checking.
2. State the plan for this phase before implementing.
3. Implement.
4. Write/update tests for what changed.
5. Run type checking, lint, and the relevant tests.
6. Verify the behavior actually works (not just "compiles").
7. Document notable architectural decisions made during the phase in `docs/`.
8. Stop at a coherent, working milestone and summarize what changed before moving on.

Do not rewrite already-working code unless the current phase requires it — extend, don't churn.

**Phase 0 — Monorepo foundation.** Repository scaffold per §3, shared tooling (`tsconfig`, eslint, vitest config), empty-but-wired packages, root README stub, license, CI skeleton (typecheck + lint + test on push). No email logic yet.

**Phase 1 — Core domain model + local development environment.** `packages/core` domain types and zod schemas (§4). D1 schema + first migrations. Local D1 setup, seed script, email fixtures (§19). No Cloudflare Worker yet — this phase proves the domain model and local dev loop.

**Phase 2 — Inbound email Worker + ingestion API.** `workers/email-receiver` with MIME parsing, normalization, HMAC-signed POST to `/api/inbound/email` (§5, §9). Backend route with signature verification, replay protection, idempotency (fingerprint-based dedup), basic thread resolution. Local simulated sending via Wrangler's default email-binding behavior for testing the loop end-to-end without real DNS.

**Phase 3 — D1/R2 persistence + mailbox APIs.** Full repository layer in `packages/cloudflare`, attachment/raw-MIME storage in R2 with private-bucket + signed-URL access, `mailboxService`/`messageService`/`threadService` in `packages/server`.

**Phase 4 — Nuxt framework APIs + default UI skeleton.** `packages/nuxt` module wiring composables to the server services via authenticated API routes; `packages/ui` primitives (§17) with `packages/theme` tokens; `apps/web` reference app assembling them into a working (read-only at this point) mailbox view. This is the first point the framework/app split is concretely testable.

**Phase 5 — Threading + attachments + search.** Full `In-Reply-To`/`References` threading with documented fallback, attachment upload/download flows end-to-end through the UI, FTS5 search (§16) with triggers keeping the index in sync, search UI.

**Phase 6 — Outbound email + compose + drafts.** `MailTransport`/`CloudflareEmailTransport` (§6), compose/reply/forward UI, autosaving drafts, send confirmation and error handling in the UI.

**Phase 7 — Realtime.** Per-mailbox Durable Object with WebSocket Hibernation (§11), backend event fan-out on ingestion/state change, client subscription via `useRealtimeMailbox()`, SSE/poll fallback.

**Phase 8 — Authentication + authorization hardening.** Full auth flow appropriate for self-hosted multi-user (§13), Cloudflare Access as a documented alternate mode for personal deployments, authorization checks audited across every service method, ingestion signing hardened per the production recommendation noted in §9, rate limiting on ingestion and auth endpoints.

**Phase 9 — Tauri desktop.** `apps/desktop` wrapping the built web app, native notification integration (§12), secure credential storage for any locally-cached session material, system tray/lifecycle basics.

**Phase 10 — Tauri mobile + push notifications.** iOS/Android targets, mobile push plugin integration for APNs/FCM (§12), background notification delivery testing.

**Phase 11 — CLI + Cloudflare provisioning.** Scaffolding CLI (§20) building on the by-now-proven manual deployment workflow; where practical, automate D1/R2/Queue/Email-Service provisioning via Wrangler, with clear manual fallback instructions for anything not automatable.

**Phase 12 — Documentation + security review + release.** Full docs pass (§21), a dedicated security review against §15's requirements with findings tracked and resolved, `examples/default-mail` verified to work using only public package APIs, first tagged release.

Adjust phase ordering only if implementation reveals a genuine dependency problem — if you do, explain why before deviating.

---

## 23. Working rules for every phase

- Inspect the repository before making changes; do not assume prior state.
- Do not assume a Cloudflare, Nuxt, or Tauri API exists or behaves a certain way — verify against current official docs when in doubt, since these platforms move quickly.
- Keep dependencies minimal; justify any new dependency in the phase summary.
- Never expose secrets to the client or commit them to the repo.
- Never invent APIs or write fake/stub implementations that pretend to work — if something can't be completed in the current phase, say so explicitly and leave a clearly marked TODO with a tracking note, not a silent fake.
- Business logic stays out of Vue components; UI-agnostic logic stays out of `packages/ui`/`apps/web`'s theme-specific code.
- Email infrastructure (`packages/core`, `packages/cloudflare`, `workers/*`) must remain independent of any UI concern.
- The default theme (`packages/theme`) must remain independent of `packages/core`'s implementation details.
- Use migrations for all schema changes.
- Preserve backwards compatibility for already-shipped public APIs where reasonable; call out breaking changes explicitly.
- Document non-obvious architectural decisions where you make them, not retroactively.
- Treat all inbound email content as hostile, always (§15).
- `apps/web` must consume `packages/*` framework APIs rather than reimplementing logic locally — it is the dogfooding proof, not a special case.
- Stop after each phase, verify, and report before continuing to the next.

---

## 24. Acceptance criteria (overall)

The project is "done" for a given milestone when:

- A developer with a Cloudflare-managed domain can follow `docs/deployment.md` to configure Email Routing/Email Service, provision D1/R2, and deploy the app to their own Cloudflare account, ending with a working mailbox at their chosen address.
- That mailbox is usable from the web app, and — once Phases 9–10 land — from desktop and mobile apps built from the same Vue codebase.
- A developer can clone the repo and run a realistic local mailbox without owning a domain or touching real Cloudflare infrastructure (§19).
- A developer can replace individual default-theme components (sidebar, message list, composer, etc.) using documented extension points, and separately, can build a fully custom mailbox UI using only the framework APIs without the default theme.
- Inbound HTML email cannot execute script, read cookies/localStorage, or reach Tauri APIs, verified by tests.
- Duplicate inbound delivery of the same message never creates a duplicate `Message` row, verified by tests.
- All type checks, lint, and tests pass at each phase boundary before moving to the next phase.
