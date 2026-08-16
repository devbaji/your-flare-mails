# Outbound email + compose (Phase 6)

```
Composer UI → draft CRUD APIs → POST /api/drafts/:id/send
  → persist outbound Message (status: sending)
  → MailTransport.send()
       MockMailTransport (local default) or CloudflareEmailTransport (send_email)
  → status: sent | failed
  → delete draft on success
```

The browser never holds send credentials — only authenticated API calls.

## Transport

| Implementation | Package | When |
| --- | --- | --- |
| `MockMailTransport` | `@your-flare-mails/core` | Local default (`FORCE_MOCK_TRANSPORT=true`) |
| `CloudflareEmailTransport` | `@your-flare-mails/cloudflare` | Workers `send_email` binding (`env.EMAIL`) |

Wrangler simulates `send_email` locally (logs; does not deliver). Set binding
`remote: true` only for deliberate real sends to test addresses.

## Draft + send routes

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/mailboxes/:id/drafts` | Create draft |
| PATCH | `/api/drafts/:id` | Autosave / update |
| DELETE | `/api/drafts/:id` | Discard |
| POST | `/api/drafts/:id/send` | Send draft |
| POST | `/api/messages/:id/reply-draft` | Prefill reply |
| POST | `/api/messages/:id/forward-draft` | Prefill forward |

## UI

- `Composer` primitive + `useCompose()` / `useDraft()` (800ms autosave)
- Compose button, Reply / Forward on the reading pane
- Send success switches to Sent and opens the new thread; failures keep the draft and show an error
