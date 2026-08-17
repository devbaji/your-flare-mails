# Vendored `tauri-plugin-mobile-push` (patched)

Upstream `0.1.4` registers Rust `request_permission` / `get_token` handlers that
**always return `granted: false` / empty token on Android** (`#[cfg(not(target_os = "ios"))]`).
The Kotlin FCM plugin is never called, so OS notification settings are ignored.

This copy routes Android through `PluginHandle::run_mobile_plugin` →
`MobilePushPlugin.requestPermissions` / `getToken`.

Do not bump back to crates.io `0.1.x` until upstream fixes Android.
