use tauri::{command, AppHandle, Manager, Runtime};

use crate::models::*;
use crate::Result;

/// No-op handler for register_listener.
/// Intercepts the call to prevent it from falling through to run_mobile_plugin
/// (which hangs due to the PluginManager dispatch issue on iOS).
#[command]
pub(crate) async fn register_listener<R: Runtime>(_app: AppHandle<R>) -> Result<()> {
    Ok(())
}

#[cfg(target_os = "ios")]
extern "C" {
    /// Request notification permission. Blocks until user responds.
    /// Returns 1 if granted, 0 if denied.
    fn mobile_push_request_permission() -> i32;

    /// Get APNs device token. Blocks until token received or timeout.
    /// Writes hex token string to buffer. Returns token length, -1 on error, -2 on timeout.
    fn mobile_push_get_device_token(buffer: *mut i8, buffer_len: i32, timeout_secs: i32) -> i32;
}

#[command]
pub(crate) async fn request_permission<R: Runtime>(
    app: AppHandle<R>,
) -> Result<PermissionResponse> {
    #[cfg(target_os = "ios")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let result = unsafe { mobile_push_request_permission() };
            let _ = tx.send(result == 1);
        });
        let granted = rx.recv().unwrap_or(false);
        return Ok(PermissionResponse { granted });
    }

    // Upstream 0.1.4 wrongly returned granted:false for all non-iOS targets.
    #[cfg(target_os = "android")]
    {
        let state = app.state::<crate::mobile::MobilePush<R>>();
        return Ok(state.request_permission()?);
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        let _ = app;
        Ok(PermissionResponse { granted: false })
    }
}

#[command]
pub(crate) async fn get_token<R: Runtime>(app: AppHandle<R>) -> Result<TokenResponse> {
    #[cfg(target_os = "ios")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut buffer = [0i8; 256];
            let result = unsafe { mobile_push_get_device_token(buffer.as_mut_ptr(), 256, 15) };
            if result > 0 {
                let len = result as usize;
                let bytes: Vec<u8> = buffer[..len].iter().map(|&b| b as u8).collect();
                match String::from_utf8(bytes) {
                    Ok(token) => tx.send(Ok(token)),
                    Err(e) => tx.send(Err(format!("Invalid UTF-8 token: {}", e))),
                }
            } else if result == -2 {
                tx.send(Err("APNs token request timed out".to_string()))
            } else {
                tx.send(Err("Failed to get APNs device token".to_string()))
            }
        });

        return match rx.recv() {
            Ok(Ok(token)) => Ok(TokenResponse { token }),
            Ok(Err(e)) => Err(crate::Error::Io(std::io::Error::other(e))),
            Err(_) => Err(crate::Error::Io(std::io::Error::other(
                "Token fetch thread panicked",
            ))),
        };
    }

    #[cfg(target_os = "android")]
    {
        let state = app.state::<crate::mobile::MobilePush<R>>();
        return Ok(state.get_token()?);
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        let _ = app;
        Ok(TokenResponse {
            token: String::new(),
        })
    }
}
