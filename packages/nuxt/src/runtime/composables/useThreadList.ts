import type { ThreadDto } from '@your-flare-mails/api-client';
import { useState } from '#imports';

import { useYfmApi } from './useMailbox.js';

export function useThreadList(
  mailboxId: { value: string | null } | string,
  filters: { label?: { value: string | null } | string } = {},
) {
  const api = useYfmApi();
  const threads = useState<ThreadDto[]>('yfm-threads', () => []);
  const pending = useState('yfm-threads-pending', () => false);
  const error = useState<string | null>('yfm-threads-error', () => null);

  async function refresh() {
    const id = typeof mailboxId === 'string' ? mailboxId : mailboxId.value;
    if (!id) {
      threads.value = [];
      return;
    }
    const label =
      typeof filters.label === 'string'
        ? filters.label
        : (filters.label?.value ?? 'inbox');

    pending.value = true;
    error.value = null;
    try {
      const result = await api.listThreads(id, { label, limit: 50 });
      threads.value = result.threads;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load threads';
    } finally {
      pending.value = false;
    }
  }

  return { threads, pending, error, refresh };
}
