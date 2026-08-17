/**
 * Detect Tauri webview without importing @tauri-apps until needed.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    isTauri?: boolean;
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  return Boolean(
    w.isTauri ||
      w.__TAURI_INTERNALS__ ||
      w.__TAURI__ ||
      '__TAURI_INTERNALS__' in w ||
      '__TAURI__' in w,
  );
}

/**
 * Best-effort platform detection for push registration.
 */
export function detectClientPlatform(): 'web' | 'desktop' | 'ios' | 'android' {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // Some Android WebViews omit "Android" but expose Linux + Mobile.
  if (isTauri() && /Mobile|wv\)/i.test(ua) && /Linux/i.test(ua)) {
    return 'android';
  }
  if (isTauri()) {
    return 'desktop';
  }
  return 'web';
}

export function isMobileTauri(): boolean {
  if (!isTauri()) return false;
  const platform = detectClientPlatform();
  if (platform === 'ios' || platform === 'android') return true;
  // WebView UAs vary; treat non-desktop Tauri as mobile when clearly a phone.
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Mobile|Android|iPhone|iPad/i.test(ua);
}
