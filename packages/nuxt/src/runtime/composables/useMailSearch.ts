import type { SearchHitDto, SearchQuery } from '@your-flare-mails/api-client';
import { useState } from '#imports';

import { useYfmApi } from './useMailbox.js';

export function useMailSearch(mailboxId: { value: string | null } | string) {
  const api = useYfmApi();
  const query = useState<SearchQuery>('yfm-search-query', () => ({ q: '' }));
  const hits = useState<SearchHitDto[]>('yfm-search-hits', () => []);
  const pending = useState('yfm-search-pending', () => false);
  const error = useState<string | null>('yfm-search-error', () => null);
  const active = useState('yfm-search-active', () => false);

  async function search(next?: SearchQuery) {
    const id = typeof mailboxId === 'string' ? mailboxId : mailboxId.value;
    if (next) query.value = { ...query.value, ...next };
    if (!id) {
      hits.value = [];
      return;
    }
    const q = query.value.q?.trim();
    const hasFilters = Boolean(
      q ||
        query.value.from ||
        query.value.to ||
        query.value.subject ||
        query.value.hasAttachment != null ||
        query.value.unread != null,
    );
    if (!hasFilters) {
      active.value = false;
      hits.value = [];
      return;
    }
    active.value = true;
    pending.value = true;
    error.value = null;
    try {
      const result = await api.searchMailbox(id, query.value);
      hits.value = result.hits;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Search failed';
    } finally {
      pending.value = false;
    }
  }

  function clear() {
    query.value = { q: '' };
    hits.value = [];
    active.value = false;
    error.value = null;
  }

  return { query, hits, pending, error, active, search, clear };
}
