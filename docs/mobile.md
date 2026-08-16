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
| Mobile Tauri | Register APNs/FCM token; receive remote pushes |
| Browser | Device registration API ready; Web Push VAPID can reuse `push_keys_json` later |

## Init mobile projects

```bash
# Android (already scaffolded under src-tauri/gen/android when run successfully)
pnpm --filter @your-flare-mails/desktop tauri android init

# iOS requires CocoaPods + Xcode
pnpm --filter @your-flare-mails/desktop tauri ios init
```

Then:

```bash
pnpm --filter @your-flare-mails/desktop tauri android dev
pnpm --filter @your-flare-mails/desktop tauri ios dev
```

## Android FCM setup

1. Create a Firebase project and Android app.
2. Place `google-services.json` in `apps/desktop/src-tauri/gen/android/app/`.
3. Apply the Google Services Gradle plugin and `firebase-messaging` dependency
   (see plugin README).
4. Register `app.tauri.mobilepush.FCMService` in `AndroidManifest.xml`.
5. Set `FCM_SERVICE_ACCOUNT_JSON` on `workers/api` (full service-account JSON).

## iOS APNs setup

1. Enable **Push Notifications** capability in Xcode.
2. Create an APNs Auth Key (`.p8`) in Apple Developer.
3. Set on `workers/api`:

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
3. On a physical Android/iOS device with real credentials: confirm OS notification
   while the app is backgrounded (WebSocket alone is not enough).

## Out of scope

- Full Web Push (VAPID) browser delivery (schema supports it; wire later)
- Guaranteed iOS event listeners from the plugin (known plugin limitation;
  token registration works)
