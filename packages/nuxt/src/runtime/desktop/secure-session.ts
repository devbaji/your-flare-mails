import { isTauri } from './platform.js';

const SESSION_KEY = 'session_token';
const CSRF_KEY = 'csrf_token';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

/**
 * Persist session material in the OS keychain when running inside Tauri.
 * No-ops in the browser.
 */
export async function storeDesktopSession(input: {
  sessionToken: string;
  csrfToken: string | null;
}): Promise<void> {
  if (!isTauri()) return;
  await invoke('secret_set', { key: SESSION_KEY, value: input.sessionToken });
  if (input.csrfToken) {
    await invoke('secret_set', { key: CSRF_KEY, value: input.csrfToken });
  }
}

export async function loadDesktopSession(): Promise<{
  sessionToken: string | null;
  csrfToken: string | null;
}> {
  if (!isTauri()) {
    return { sessionToken: null, csrfToken: null };
  }
  const sessionToken = await invoke<string | null>('secret_get', { key: SESSION_KEY });
  const csrfToken = await invoke<string | null>('secret_get', { key: CSRF_KEY });
  return {
    sessionToken: sessionToken ?? null,
    csrfToken: csrfToken ?? null,
  };
}

export async function clearDesktopSession(): Promise<void> {
  if (!isTauri()) return;
  await invoke('secret_delete', { key: SESSION_KEY });
  await invoke('secret_delete', { key: CSRF_KEY });
}
