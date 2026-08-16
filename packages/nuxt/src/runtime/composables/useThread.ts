import type { MessageDto, ThreadDto } from '@your-flare-mails/api-client';
import { useState } from '#imports';

import { useYfmApi } from './useMailbox.js';

export function useThread(threadId: { value: string | null } | string) {
  const api = useYfmApi();
  const thread = useState<ThreadDto | null>('yfm-thread', () => null);
  const messages = useState<MessageDto[]>('yfm-thread-messages', () => []);
  const pending = useState('yfm-thread-pending', () => false);
  const error = useState<string | null>('yfm-thread-error', () => null);

  async function refresh() {
    const id = typeof threadId === 'string' ? threadId : threadId.value;
    if (!id) {
      thread.value = null;
      messages.value = [];
      return;
    }
    pending.value = true;
    error.value = null;
    try {
      const [threadResult, messagesResult] = await Promise.all([
        api.getThread(id),
        api.listThreadMessages(id),
      ]);
      thread.value = threadResult.thread;
      messages.value = messagesResult.messages;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load thread';
    } finally {
      pending.value = false;
    }
  }

  return { thread, messages, pending, error, refresh };
}
