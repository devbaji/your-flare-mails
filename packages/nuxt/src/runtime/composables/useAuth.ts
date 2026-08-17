import { MailApiError, type UserDto } from '@your-flare-mails/api-client';
import { useRouter, useState } from '#imports';

import {
  clearDesktopSession,
  loadDesktopSession,
  peekLocalSession,
  storeDesktopSession,
} from '../desktop/secure-session.js';
import { useYfmApi } from './useMailbox.js';

let ensurePromise: Promise<UserDto | null> | null = null;

export function useAuth() {
  const router = useRouter();
  const user = useState<UserDto | null>('yfm-auth-user', () => null);
  const sessionToken = useState<string | null>('yfm-session-token', () => null);
  const csrfToken = useState<string | null>('yfm-csrf-token', () => null);
  const pending = useState('yfm-auth-pending', () => false);
  const error = useState<string | null>('yfm-auth-error', () => null);
  /** False until the first session restore / /me attempt finishes. */
  const ready = useState('yfm-auth-ready', () => false);

  function api() {
    return useYfmApi();
  }

  function hydrateFromStorage() {
    if (sessionToken.value) return;
    const peek = peekLocalSession();
    if (peek.sessionToken) {
      sessionToken.value = peek.sessionToken;
      csrfToken.value = peek.csrfToken;
    }
  }

  async function login(email: string, password: string) {
    pending.value = true;
    error.value = null;
    try {
      const result = await api().login(email, password);
      user.value = result.user;
      sessionToken.value = result.sessionToken;
      csrfToken.value = result.csrfToken;
      ready.value = true;
      ensurePromise = null;
      await storeDesktopSession({
        sessionToken: result.sessionToken,
        csrfToken: result.csrfToken,
      });
      return result.user;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    } finally {
      pending.value = false;
    }
  }

  async function logout() {
    try {
      await api().logout();
    } catch {
      // clear local state even if network fails
    }
    user.value = null;
    sessionToken.value = null;
    csrfToken.value = null;
    error.value = null;
    ready.value = true;
    ensurePromise = null;
    await clearDesktopSession();
    await router.push('/login');
  }

  async function refreshSession() {
    hydrateFromStorage();
    if (!sessionToken.value) {
      const stored = await loadDesktopSession();
      if (stored.sessionToken) {
        sessionToken.value = stored.sessionToken;
        csrfToken.value = stored.csrfToken;
      }
    }
    if (!sessionToken.value) {
      user.value = null;
      error.value = null;
      return null;
    }

    const client = api();
    if (!client || typeof client.me !== 'function') {
      // Don't wipe a valid stored session if the API plugin isn't ready yet.
      throw new Error('API client not ready');
    }

    pending.value = true;
    error.value = null;
    try {
      const result = await client.me();
      user.value = result.user;
      if (result.csrfToken) csrfToken.value = result.csrfToken;
      await storeDesktopSession({
        sessionToken: sessionToken.value,
        csrfToken: csrfToken.value,
      });
      return result.user;
    } catch (err) {
      const status = err instanceof MailApiError ? err.status : 0;
      const unauthorized = status === 401 || status === 403;
      if (unauthorized) {
        user.value = null;
        sessionToken.value = null;
        csrfToken.value = null;
        await clearDesktopSession();
        error.value = null;
      } else if (err instanceof Error && err.message === 'API client not ready') {
        // Leave tokens in place for a later retry.
        throw err;
      } else {
        // Network / server blip — keep tokens, surface a soft message only if useful.
        error.value = err instanceof Error ? err.message : 'Session check failed';
      }
      return null;
    } finally {
      pending.value = false;
    }
  }

  /** Single-flight bootstrap used by the client plugin and pages. */
  async function ensureSession(): Promise<UserDto | null> {
    if (ready.value) {
      return user.value;
    }
    if (!ensurePromise) {
      ensurePromise = (async () => {
        try {
          return await refreshSession();
        } catch (err) {
          // Allow a later page-level retry if the API plugin raced.
          if (err instanceof Error && err.message === 'API client not ready') {
            ensurePromise = null;
            return null;
          }
          return null;
        } finally {
          ready.value = true;
        }
      })();
    }
    return ensurePromise;
  }

  return {
    user,
    sessionToken,
    csrfToken,
    pending,
    error,
    ready,
    login,
    logout,
    refreshSession,
    ensureSession,
    isAuthenticated: () => Boolean(user.value && sessionToken.value),
  };
}
