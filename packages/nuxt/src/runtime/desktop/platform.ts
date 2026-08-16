/**
 * Detect Tauri webview without importing @tauri-apps until needed.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/**
 * Best-effort platform detection for push registration.
 */
export function detectClientPlatform(): 'web' | 'desktop' | 'ios' | 'android' {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (isTauri()) {
    // Desktop Tauri webview (mobile Tauri uses mobile UA above).
    return 'desktop';
  }
  return 'web';
}

export function isMobileTauri(): boolean {
  if (!isTauri()) return false;
  const platform = detectClientPlatform();
  return platform === 'ios' || platform === 'android';
}
