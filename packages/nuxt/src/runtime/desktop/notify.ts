import { isTauri } from './platform.js';

export type NotifyInput = {
  title: string;
  body: string;
};

type RealtimeNotifyEvent = {
  type: string;
  messageId?: string;
};

/**
 * Cross-platform notification helper.
 * Desktop (Tauri): OS notification plugin while the app is running.
 * Browser: no-op in Phase 9 (Web Push is a later enhancement).
 */
export async function notifyLocal(input: NotifyInput): Promise<void> {
  if (!isTauri()) return;
  try {
    const {
      isPermissionGranted,
      requestPermission,
      sendNotification,
    } = await import('@tauri-apps/plugin-notification');
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    if (!granted) return;
    sendNotification({ title: input.title, body: input.body });
  } catch {
    // Plugin missing or denied — ignore.
  }
}

export function notifyFromRealtimeEvent(event: RealtimeNotifyEvent): void {
  if (event.type === 'ping') return;
  if (event.type === 'message.created' && event.messageId) {
    void notifyLocal({
      title: 'New mail',
      body: `Message ${event.messageId} arrived`,
    });
    return;
  }
  if (event.type === 'message.sent' && event.messageId) {
    void notifyLocal({
      title: 'Message sent',
      body: `Message ${event.messageId} was sent`,
    });
  }
}
