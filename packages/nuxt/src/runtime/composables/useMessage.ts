import type { MessageDetailDto } from '@your-flare-mails/api-client';
import { useState } from '#imports';

import { useYfmApi } from './useMailbox.js';

export function useMessage(messageId: { value: string | null } | string) {
  const api = useYfmApi();
  const detail = useState<MessageDetailDto | null>('yfm-message', () => null);
  const pending = useState('yfm-message-pending', () => false);
  const error = useState<string | null>('yfm-message-error', () => null);

  async function refresh() {
    const id = typeof messageId === 'string' ? messageId : messageId.value;
    if (!id) {
      detail.value = null;
      return;
    }
    pending.value = true;
    error.value = null;
    try {
      detail.value = await api.getMessage(id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load message';
    } finally {
      pending.value = false;
    }
  }

  return { detail, pending, error, refresh };
}
