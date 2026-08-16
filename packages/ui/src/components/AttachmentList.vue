<script setup lang="ts">
import { computed } from 'vue';

export type AttachmentListItem = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  isInline?: boolean;
};

const props = defineProps<{
  attachments: AttachmentListItem[];
  downloadingId?: string | null;
}>();

const emit = defineEmits<{
  download: [attachmentId: string];
}>();

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const visible = computed(() =>
  props.attachments.filter((item) => !item.isInline),
);
</script>

<template>
  <section v-if="visible.length" class="yfm-attachments">
    <h3>Attachments</h3>
    <ul>
      <li v-for="item in visible" :key="item.id">
        <div>
          <strong>{{ item.filename }}</strong>
          <span>{{ item.contentType }} · {{ formatSize(item.sizeBytes) }}</span>
        </div>
        <button
          type="button"
          :disabled="downloadingId === item.id"
          @click="emit('download', item.id)"
        >
          {{ downloadingId === item.id ? 'Preparing…' : 'Download' }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.yfm-attachments {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--yfm-border);
}

.yfm-attachments h3 {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
}

.yfm-attachments ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.yfm-attachments li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 0.65rem 0.75rem;
  background: var(--yfm-bg-muted);
  border-radius: var(--yfm-radius);
}

.yfm-attachments li div {
  display: grid;
  gap: 0.15rem;
}

.yfm-attachments li span {
  color: var(--yfm-fg-muted);
  font-size: 0.8rem;
}

.yfm-attachments button {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: var(--yfm-accent);
  border-radius: var(--yfm-radius);
  padding: 0.4rem 0.75rem;
  font: inherit;
  cursor: pointer;
}

.yfm-attachments button:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
