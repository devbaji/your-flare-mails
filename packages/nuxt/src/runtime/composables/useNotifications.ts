import { notifyFromRealtimeEvent, notifyLocal } from '../desktop/notify.js';
import {
  detectClientPlatform,
  isMobileTauri,
  isTauri,
} from '../desktop/platform.js';
import { useYfmApi } from './useMailbox.js';

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
    const platform = input.platform ?? detectClientPlatform();
    let pushEndpoint = input.pushEndpoint ?? '';

    if (isMobileTauri() && !pushEndpoint) {
      const mobilePush = await import('tauri-plugin-mobile-push-api');
      const permission = await mobilePush.requestPermission();
      if (!permission.granted) {
        throw new Error('push permission denied');
      }
      pushEndpoint = await mobilePush.getToken();
    }

    if (!pushEndpoint) {
      throw new Error('pushEndpoint is required');
    }

    return api.registerDevice({
      platform,
      pushEndpoint,
      pushKeysJson: input.pushKeysJson ?? null,
      mailboxId: input.mailboxId,
    });
  }

  async function unregisterPushDevice(deviceId: string) {
    await api.unregisterDevice(deviceId);
  }

  return {
    isDesktop: isTauri,
    isMobile: isMobileTauri,
    detectClientPlatform,
    notifyLocal,
    notifyFromRealtimeEvent,
    registerPushDevice,
    unregisterPushDevice,
  };
}
