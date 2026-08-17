use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::{PermissionResponse, TokenResponse};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_mobile_push);

/// Initializes the Kotlin or Swift plugin classes.
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<MobilePush<R>> {
    log::info!("[mobile-push] mobile::init() called");
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin("app.tauri.mobilepush", "MobilePushPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_mobile_push)?;
    log::info!("[mobile-push] Plugin registered successfully");
    Ok(MobilePush(handle))
}

/// Access to the native mobile plugin (Android Kotlin / iOS Swift).
pub struct MobilePush<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> MobilePush<R> {
    /// Android: request POST_NOTIFICATIONS via Kotlin `requestPermissions`.
    #[cfg(target_os = "android")]
    pub fn request_permission(&self) -> crate::Result<PermissionResponse> {
        Ok(self.0.run_mobile_plugin("requestPermissions", ())?)
    }

    /// Android: FCM registration token via Kotlin `getToken`.
    #[cfg(target_os = "android")]
    pub fn get_token(&self) -> crate::Result<TokenResponse> {
        Ok(self.0.run_mobile_plugin("getToken", ())?)
    }
}
