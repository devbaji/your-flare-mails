import { notifyFromRealtimeEvent, notifyLocal } from '../desktop/notify.js';
import { isTauri } from '../desktop/platform.js';

/**
 * Framework notification surface.
 * Phase 9: local OS notifications in Tauri.
 * Phase 10+: resolve Web Push / APNs / FCM from Device records.
 */
export function useNotifications() {
  return {
    isDesktop: isTauri,
    notifyLocal,
    notifyFromRealtimeEvent,
  };
}
