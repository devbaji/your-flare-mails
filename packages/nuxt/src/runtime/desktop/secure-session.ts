import { isTauri } from './platform.js';

const SESSION_KEY = 'session_token';
const CSRF_KEY = 'csrf_token';
const LS_SESSION = 'yfm-session-token';
const LS_CSRF = 'yfm-csrf-token';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

function readLocal(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

/** Sync peek for first paint — avoids waiting on Tauri IPC / async load. */
export function peekLocalSession(): {
  sessionToken: string | null;
  csrfToken: string | null;
} {
  return {
    sessionToken: readLocal(LS_SESSION),
    csrfToken: readLocal(LS_CSRF),
  };
}

/**
 * Persist session for web refresh + Tauri (including Android, where OS keyring
 * is unreliable). Always writes localStorage; desktop Tauri also tries keyring.
 */
export async function storeDesktopSession(input: {
  sessionToken: string;
  csrfToken: string | null;
}): Promise<void> {
  writeLocal(LS_SESSION, input.sessionToken);
  writeLocal(LS_CSRF, input.csrfToken);

  if (!isTauri()) return;
  try {
    await invoke('secret_set', { key: SESSION_KEY, value: input.sessionToken });
    if (input.csrfToken) {
      await invoke('secret_set', { key: CSRF_KEY, value: input.csrfToken });
    }
  } catch (err) {
    // Android / unsupported keyring — localStorage is enough.
    console.warn('[session] keyring store skipped', err);
  }
}

export async function loadDesktopSession(): Promise<{
  sessionToken: string | null;
  csrfToken: string | null;
}> {
  let sessionToken: string | null = null;
  let csrfToken: string | null = null;

  if (isTauri()) {
    try {
      sessionToken = await invoke<string | null>('secret_get', { key: SESSION_KEY });
      csrfToken = await invoke<string | null>('secret_get', { key: CSRF_KEY });
    } catch (err) {
      console.warn('[session] keyring load skipped', err);
    }
  }

  if (!sessionToken) sessionToken = readLocal(LS_SESSION);
  if (!csrfToken) csrfToken = readLocal(LS_CSRF);

  return {
    sessionToken: sessionToken ?? null,
    csrfToken: csrfToken ?? null,
  };
}

export async function clearDesktopSession(): Promise<void> {
  writeLocal(LS_SESSION, null);
  writeLocal(LS_CSRF, null);
  if (!isTauri()) return;
  try {
    await invoke('secret_delete', { key: SESSION_KEY });
    await invoke('secret_delete', { key: CSRF_KEY });
  } catch (err) {
    console.warn('[session] keyring clear skipped', err);
  }
}
