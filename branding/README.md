# Branding — Devbaji Mails

Source mark: **DB** monogram inside a mail envelope on teal plate.

| File | Use |
|------|-----|
| `logo.svg` | Master vector |
| `app-icon.png` | 1024×1024 source for Tauri / stores |
| `app-icon-square.png` | Full-bleed square (Android densities) |
| `logo-*.png` | Pre-rendered sizes |

## Regenerate platform icons

```bash
# From apps/desktop — writes src-tauri/icons (+ iOS)
pnpm exec tauri icon ../../branding/app-icon.png

# Web public assets (copy from branding/)
cp branding/logo.svg apps/web/public/favicon.svg
cp branding/logo.svg apps/web/public/logo.svg
# …plus favicon-*.png / apple-touch-icon / icon-192 / icon-512 as needed
```

Android launcher mipmaps live under `apps/desktop/src-tauri/gen/android/app/src/main/res/mipmap-*`.
