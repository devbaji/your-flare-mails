# Branding — Devbaji Mails

Master raster source: ChatGPT-generated DB+envelope mark (dark navy rounded squircle on transparent canvas).

| File | Use |
|------|-----|
| `source-icon.png` | Original source PNG (reference) |
| `app-icon.png` / `app-icon-1024.png` | 1024×1024 RGBA master (transparent outside squircle) — Tauri / stores |
| `app-icon-square.png` | 1024×1024 adaptive foreground (~86% fill, transparent padding) |
| `logo-*.png` | Pre-rendered sizes (16–512) |
| `logo.svg` | Legacy vector; prefer raster masters above for icons |

## Regenerate platform icons

```bash
# From apps/desktop — writes src-tauri/icons (+ iOS)
pnpm exec tauri icon ../../branding/app-icon.png

# Web public assets (from branding/)
# favicon-16/32, apple-touch-icon (180), icon-192/512, logo.png (128), favicon.ico
```

Android launcher mipmaps live under `apps/desktop/src-tauri/gen/android/app/src/main/res/mipmap-*`.
