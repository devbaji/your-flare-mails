/**
 * Detect Tauri webview without importing @tauri-apps until needed.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}
