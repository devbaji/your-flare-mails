import type { UserDto } from '@your-flare-mails/api-client';
import { useRouter, useState } from '#imports';

import {
  clearDesktopSession,
  loadDesktopSession,
  storeDesktopSession,
} from '../desktop/secure-session.js';
import { useYfmApi } from './useMailbox.js';

export function useAuth() {
  const api = useYfmApi();
  const router = useRouter();
  const user = useState<UserDto | null>('yfm-auth-user', () => null);
  const sessionToken = useState<string | null>('yfm-session-token', () => null);
  const csrfToken = useState<string | null>('yfm-csrf-token', () => null);
  const pending = useState('yfm-auth-pending', () => false);
  const error = useState<string | null>('yfm-auth-error', () => null);

  async function login(email: string, password: string) {
    pending.value = true;
    error.value = null;
    try {
      const result = await api.login(email, password);
      user.value = result.user;
      sessionToken.value = result.sessionToken;
      csrfToken.value = result.csrfToken;
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
      await api.logout();
    } catch {
      // clear local state even if network fails
    }
    user.value = null;
    sessionToken.value = null;
    csrfToken.value = null;
    await clearDesktopSession();
    await router.push('/login');
  }

  async function refreshSession() {
    if (!sessionToken.value) {
      const stored = await loadDesktopSession();
      if (stored.sessionToken) {
        sessionToken.value = stored.sessionToken;
        csrfToken.value = stored.csrfToken;
      }
    }
    if (!sessionToken.value) {
      user.value = null;
      return null;
    }
    pending.value = true;
    error.value = null;
    try {
      const result = await api.me();
      user.value = result.user;
      if (result.csrfToken) csrfToken.value = result.csrfToken;
      await storeDesktopSession({
        sessionToken: sessionToken.value,
        csrfToken: csrfToken.value,
      });
      return result.user;
    } catch (err) {
      user.value = null;
      sessionToken.value = null;
      csrfToken.value = null;
      await clearDesktopSession();
      error.value = err instanceof Error ? err.message : 'Session expired';
      return null;
    } finally {
      pending.value = false;
    }
  }

  return {
    user,
    sessionToken,
    csrfToken,
    pending,
    error,
    login,
    logout,
    refreshSession,
    isAuthenticated: () => Boolean(user.value && sessionToken.value),
  };
}
