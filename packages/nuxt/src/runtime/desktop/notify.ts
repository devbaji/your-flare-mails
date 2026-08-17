import { isMobileTauri, isTauri } from './platform.js';

export type NotifyInput = {
  title: string;
  body: string;
};

type RealtimeNotifyEvent = {
  type: string;
  messageId?: string;
  subject?: string | null;
};

/**
 * Cross-platform notification helper.
 * Desktop (Tauri): OS notification plugin while the app is running.
 * Mobile: skip — remote FCM/APNs handles background; local toasts on open
 * caused confusing "Message msg_…" spam.
 * Browser: no-op (Web Push later).
 */
export async function notifyLocal(input: NotifyInput): Promise<void> {
  if (!isTauri() || isMobileTauri()) return;
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
  // Mobile uses FCM remote push while closed; don't duplicate on reconnect.
  if (isMobileTauri()) return;

  const subject = event.subject?.trim();
  if (event.type === 'message.created') {
    void notifyLocal({
      title: 'New mail',
      body: subject || 'A new message arrived in your mailbox',
    });
    return;
  }
  if (event.type === 'message.sent') {
    void notifyLocal({
      title: 'Message sent',
      body: subject || 'Your message was sent',
    });
  }
}
