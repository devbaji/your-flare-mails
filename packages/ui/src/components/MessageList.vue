<script setup lang="ts">
export type MessageListItem = {
  id: string;
  fromName: string | null;
  fromAddress: string;
  subject: string | null;
  date: string;
  snippet?: string | null;
  hasAttachments?: boolean;
};

defineProps<{
  messages: MessageListItem[];
  activeId?: string | null;
}>();

defineEmits<{
  select: [messageId: string];
}>();
</script>

<template>
  <div class="yfm-message-list">
    <button
      v-for="message in messages"
      :key="message.id"
      type="button"
      class="yfm-message-list__item"
      :class="{ 'is-active': activeId === message.id }"
      @click="$emit('select', message.id)"
    >
      <strong>{{ message.fromName || message.fromAddress }}</strong>
      <span>{{ new Date(message.date).toLocaleString() }}</span>
      <p>
        {{ message.subject || '(no subject)' }}
        <em v-if="message.hasAttachments" class="yfm-message-list__clip"> · file</em>
      </p>
    </button>
  </div>
</template>

<style scoped>
.yfm-message-list__item {
  width: 100%;
  appearance: none;
  border: 0;
  border-bottom: 1px solid var(--yfm-border);
  background: transparent;
  text-align: left;
  padding: 0.75rem 1rem;
  display: grid;
  gap: 0.2rem;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.yfm-message-list__item.is-active,
.yfm-message-list__item:hover {
  background: var(--yfm-bg-muted);
}

.yfm-message-list__item span {
  color: var(--yfm-fg-muted);
  font-size: 0.8rem;
}

.yfm-message-list__item p {
  margin: 0;
  color: var(--yfm-fg-muted);
}
</style>
