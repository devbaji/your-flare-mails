import { notifyFromRealtimeEvent, notifyLocal } from '../desktop/notify.js';
import {
  detectClientPlatform,
  isMobileTauri,
  isTauri,
} from '../desktop/platform.js';
import { useYfmApi } from './useMailbox.js';

type RegisteredDevice = {
  id: string;
  mailboxId: string;
  pushEndpoint: string;
};

let tokenRefreshUnsub: { unregister: () => void } | null = null;
let lastRegistration: RegisteredDevice | null = null;

function resolveMobilePlatform(
  preferred?: 'web' | 'desktop' | 'ios' | 'android',
): 'ios' | 'android' {
  const detected = preferred ?? detectClientPlatform();
  if (detected === 'ios') return 'ios';
  if (detected === 'android') return 'android';
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  }
  // Tauri mobile push token implies a phone; default Android.
  return 'android';
}

/**
 * Framework notification surface.
 * - Desktop Tauri: local OS toasts on realtime events
 * - Mobile Tauri: remote push via APNs/FCM token registration
 * - Web: registration reserved for Web Push (endpoint stored on Device)
 */
export function useNotifications() {
  const api = useYfmApi();

  async function registerPushDevice(input: {
    mailboxId: string;
    platform?: 'web' | 'desktop' | 'ios' | 'android';
    pushEndpoint?: string;
    pushKeysJson?: string | null;
  }) {
    if (!isTauri()) {
      throw new Error('push registration requires the Tauri app');
    }

    let pushEndpoint = input.pushEndpoint ?? '';

    if (!pushEndpoint) {
      const mobilePush = await import('tauri-plugin-mobile-push-api');
      const permission = await mobilePush.requestPermission();
      pushEndpoint = (await mobilePush.getToken()).trim();
      if (!pushEndpoint) {
        throw new Error(
          permission.granted
            ? 'empty push token — check google-services.json / FCM on the device'
            : 'push permission denied',
        );
      }

      if (!tokenRefreshUnsub) {
        try {
          tokenRefreshUnsub = await mobilePush.onTokenRefresh(async ({ token }) => {
            if (!lastRegistration || !token) return;
            try {
              const result = await api.registerDevice({
                platform: resolveMobilePlatform(),
                pushEndpoint: token,
                mailboxId: lastRegistration.mailboxId,
              });
              lastRegistration = {
                id: result.device.id,
                mailboxId: lastRegistration.mailboxId,
                pushEndpoint: token,
              };
            } catch {
              // best-effort re-register
            }
          });
        } catch {
          // listener optional
        }
      }
    }

    const registerPlatform = resolveMobilePlatform(input.platform);

    const result = await api.registerDevice({
      platform: registerPlatform,
      pushEndpoint,
      pushKeysJson: input.pushKeysJson ?? null,
      mailboxId: input.mailboxId,
    });

    lastRegistration = {
      id: result.device.id,
      mailboxId: input.mailboxId,
      pushEndpoint,
    };

    return result;
  }

  async function unregisterPushDevice(deviceId: string) {
    await api.unregisterDevice(deviceId);
    if (lastRegistration?.id === deviceId) lastRegistration = null;
  }

  return {
    isDesktop: isTauri,
    isMobile: isMobileTauri,
    isTauri,
    detectClientPlatform,
    notifyLocal,
    notifyFromRealtimeEvent,
    registerPushDevice,
    unregisterPushDevice,
  };
}
