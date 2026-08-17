import type { MailApiClient } from '@your-flare-mails/api-client';
import { useNuxtApp, useState } from '#imports';

export function useYfmApi(): MailApiClient {
  const api = useNuxtApp().$yfmApi as MailApiClient | undefined;
  if (!api) {
    throw new Error('API client not ready');
  }
  return api;
}

export function useMailbox() {
  const api = useYfmApi();
  const mailboxes = useState('yfm-mailboxes', () => [] as Awaited<
    ReturnType<MailApiClient['listMailboxes']>
  >['mailboxes']);
  const currentId = useState<string | null>('yfm-mailbox-id', () => null);
  const error = useState<string | null>('yfm-mailbox-error', () => null);
  const pending = useState('yfm-mailbox-pending', () => false);

  async function refresh() {
    pending.value = true;
    error.value = null;
    try {
      const result = await api.listMailboxes();
      mailboxes.value = result.mailboxes;
      if (!currentId.value && result.mailboxes[0]) {
        currentId.value = result.mailboxes[0].id;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load mailboxes';
    } finally {
      pending.value = false;
    }
  }

  function selectMailbox(id: string) {
    currentId.value = id;
  }

  return {
    mailboxes,
    currentId,
    error,
    pending,
    refresh,
    selectMailbox,
  };
}
