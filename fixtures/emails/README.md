# Email fixtures

Raw MIME samples used by tests and local development. All addresses use
`example.com`.

| File | Covers |
| --- | --- |
| `plain-text.eml` | Plain text only |
| `multipart-html-attachment.eml` | HTML + plain multipart + PDF attachment |
| `inline-image.eml` | `multipart/related` with CID inline image |
| `missing-threading-headers.eml` | No Message-ID / In-Reply-To / References |
| `malformed-mime.eml` | Hostile/broken MIME (must fail safely) |
| `malicious-html.eml` | Script tags, event handlers, tracking pixel |
| `oversized-marker.eml` | Marker for size-limit tests (expand in test code) |

Phase 2 wires these through the real ingestion path. Until then, validate with:

```bash
pnpm fixtures:check
```
