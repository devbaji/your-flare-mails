<script setup lang="ts">
export type ThreadListItem = {
  id: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: string | null;
  isUnread: boolean;
  messageCount: number;
};

defineProps<{
  threads: ThreadListItem[];
  activeId?: string | null;
  loading?: boolean;
}>();

defineEmits<{
  select: [threadId: string];
}>();

function formatWhen(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="yfm-thread-list">
    <p v-if="loading" class="yfm-thread-list__empty">Loading threads…</p>
    <p v-else-if="threads.length === 0" class="yfm-thread-list__empty">No conversations</p>
    <button
      v-for="thread in threads"
      :key="thread.id"
      type="button"
      class="yfm-thread-list__item"
      :class="{ 'is-active': activeId === thread.id, 'is-unread': thread.isUnread }"
      @click="$emit('select', thread.id)"
    >
      <div class="yfm-thread-list__row">
        <strong>{{ thread.subject || '(no subject)' }}</strong>
        <span>{{ formatWhen(thread.lastMessageAt) }}</span>
      </div>
      <p>{{ thread.snippet || ' ' }}</p>
      <small>{{ thread.messageCount }} messages</small>
    </button>
  </div>
</template>

<style scoped>
.yfm-thread-list__empty {
  padding: 1.25rem;
  color: var(--yfm-fg-muted);
}

.yfm-thread-list__item {
  width: 100%;
  appearance: none;
  border: 0;
  border-bottom: 1px solid var(--yfm-border);
  background: transparent;
  text-align: left;
  padding: 0.9rem 1rem;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.yfm-thread-list__item:hover,
.yfm-thread-list__item.is-active {
  background: var(--yfm-bg-muted);
}

.yfm-thread-list__item.is-unread strong {
  font-weight: 700;
}

.yfm-thread-list__row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.yfm-thread-list__row span,
.yfm-thread-list__item small {
  color: var(--yfm-fg-muted);
  font-size: 0.8rem;
}

.yfm-thread-list__item p {
  margin: 0;
  color: var(--yfm-fg-muted);
  font-size: 0.9rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
