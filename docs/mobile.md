# Mobile + push notifications (Phase 10)

YourFlareMails uses the same Tauri shell (`apps/desktop`) for **iOS and Android**
targets, plus remote push through **APNs** (iOS) and **FCM** (Android).

Chosen plugin: [`tauri-plugin-mobile-push`](https://github.com/yanqianglu/tauri-plugin-mobile-push)
(+ `tauri-plugin-mobile-push-api`). It supports APNs device tokens and FCM
registration tokens, no-ops on desktop, and avoids fragile iOS method swizzling.

## Architecture

```
Mobile app (Tauri iOS/Android)
  → requestPermission + getToken (plugin)
  → POST /api/devices { platform, pushEndpoint, mailboxId }
  → D1 devices + notification_subscriptions

Inbound ingest / outbound send
  → realtime DO fan-out (Phase 7)
  → notifyMailboxDevices() → APNs / FCM / MockPushTransport
```

`useNotifications()` is the single client abstraction:

| Runtime | Behavior |
| --- | --- |
| Desktop Tauri | Local OS toasts on realtime events |
| Mobile Tauri | Register APNs/FCM token; receive remote pushes (works when app is closed) |
| Browser | Device registration API ready; Web Push VAPID can reuse `push_keys_json` later |

## Production Android APK (end-to-end)

### 1. Firebase Android app

1. Create a Firebase project → add Android app with package
   `com.yourflaremails.desktop`.
2. Download **`google-services.json`** and place it at:
   `apps/desktop/src-tauri/gen/android/app/google-services.json`
   (see `apps/desktop/google-services.json.example`; the real file is gitignored).
3. In Firebase → Project settings → Service accounts → generate a
   **service account JSON** key (used by the API worker to send FCM).

### 2. API: enable real push

```bash
# In config/deploy.local.env:
FORCE_MOCK_PUSH=false

pnpm deploy:configure
pnpm deploy:api

cd workers/api
pnpm exec wrangler secret put FCM_SERVICE_ACCOUNT_JSON --config wrangler.deploy.jsonc
# paste the full Firebase service-account JSON, then Ctrl-D
cd ../..
```

Without `FCM_SERVICE_ACCOUNT_JSON` (or with `FORCE_MOCK_PUSH=true`), the API only
logs pushes via `MockPushTransport` — the phone will not show OS notifications.

### 3. Build the release APK

Requires Android SDK / NDK / JDK as for any Tauri Android project.

```bash
pnpm deploy:configure   # ensures apps/web/.env.production.local has prod API URL
pnpm build:android
```

`beforeBuildCommand` runs `build:desktop`, which bakes
`NUXT_PUBLIC_API_BASE_URL` from `.env.production.local` into the SPA.

APK output is under:

`apps/desktop/src-tauri/gen/android/app/build/outputs/apk/`

Install on a physical device (emulator push is unreliable for FCM):

```bash
adb install -r apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk
```

(Exact path may vary by ABI / universal split.)

### 3b. Sign the APK (required to install on devices)

Release builds may emit `*-unsigned.apk`. A local keystore lives at:

- `apps/desktop/android-release.keystore` (gitignored — **back this up**)
- `apps/desktop/android-keystore.properties` (gitignored)

```bash
pnpm --filter @your-flare-mails/desktop run sign:android
```

Install the **signed** APK:

```bash
adb install -r apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-signed.apk
```

Future `pnpm build:android` runs will sign via Gradle when those keystore files exist.

### 4. First launch

1. Sign in with your production owner account.
2. Allow notification permission when prompted.
3. Confirm the mail UI loads against `https://mailsapi…` (not localhost).
4. Send a test message into the mailbox (or use inbound Email Routing).
5. With the app **force-stopped / backgrounded**, you should get an OS
   notification (“New mail”).

## Init / dev commands

```bash
pnpm --filter @your-flare-mails/desktop tauri android init   # once
pnpm dev:android
pnpm build:android
```

## Android FCM wiring (already in repo)

- Gradle: Firebase BOM + `firebase-messaging` + conditional `google-services` plugin
- `AndroidManifest.xml`: `POST_NOTIFICATIONS` + `app.tauri.mobilepush.FCMService`
- Capability: `mobile-push:default`
- API CORS always allows `http(s)://tauri.localhost` in addition to `CORS_ORIGINS`

## iOS APNs setup

1. Enable **Push Notifications** capability in Xcode.
2. Create an APNs Auth Key (`.p8`) in Apple Developer.
3. Set on `workers/api` (secrets):

```bash
APNS_TEAM_ID=...
APNS_KEY_ID=...
APNS_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APNS_BUNDLE_ID=com.yourflaremails.desktop
APNS_PRODUCTION=false   # true for TestFlight/App Store
```

## Local / CI without credentials

`FORCE_MOCK_PUSH=true` (default in local `wrangler.jsonc`) uses
`MockPushTransport`, which logs pushes instead of calling Apple/Google.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/devices` | Upsert device + optional mailbox subscription |
| DELETE | `/api/devices/:id` | Remove device |
| POST | `/api/devices/:id/mailboxes/:mailboxId` | Subscribe device to mailbox |

Auth: same session Bearer/cookie as Phase 8.

## Testing checklist

1. `pnpm typecheck && pnpm test` — includes mock push + device registration tests.
2. With mock push: register a device via API, send/ingest mail, confirm
   `[MockPushTransport]` logs.
3. On a physical Android device with real `google-services.json` + API FCM secret:
   confirm OS notification while the app is backgrounded (WebSocket alone is
   not enough).

## Out of scope

- Full Web Push (VAPID) browser delivery (schema supports it; wire later)
- Guaranteed iOS event listeners from the plugin (known plugin limitation;
  token registration works)
