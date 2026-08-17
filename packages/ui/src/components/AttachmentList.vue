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

function extensionLabel(filename: string): string {
  const part = filename.split('.').pop();
  return (part && part !== filename ? part : 'file').slice(0, 4).toUpperCase();
}

const visible = computed(() =>
  props.attachments.filter((item) => !item.isInline),
);
</script>

<template>
  <section v-if="visible.length" class="yfm-attachments" aria-label="Attachments">
    <h3>{{ visible.length }} attachment{{ visible.length === 1 ? '' : 's' }}</h3>
    <ul>
      <li v-for="item in visible" :key="item.id">
        <span class="yfm-attachments__badge" aria-hidden="true">{{
          extensionLabel(item.filename)
        }}</span>
        <div class="yfm-attachments__meta">
          <strong>{{ item.filename }}</strong>
          <span>{{ formatSize(item.sizeBytes) }} · {{ item.contentType }}</span>
        </div>
        <button
          type="button"
          class="yfm-attachments__download"
          :disabled="downloadingId === item.id"
          :aria-label="`Download ${item.filename}`"
          @click="emit('download', item.id)"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span class="yfm-attachments__download-label">{{
            downloadingId === item.id ? '…' : 'Download'
          }}</span>
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
  gap: 0.75rem;
  align-items: center;
  padding: 0.55rem 0.65rem;
  background: var(--yfm-bg-muted);
  border-radius: var(--yfm-radius);
}

.yfm-attachments__badge {
  flex-shrink: 0;
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border-radius: 0.4rem;
  background: color-mix(in srgb, var(--yfm-accent) 18%, transparent);
  color: var(--yfm-accent);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.yfm-attachments__meta {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.yfm-attachments__meta strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.yfm-attachments__meta span {
  color: var(--yfm-fg-muted);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.yfm-attachments__download {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: var(--yfm-accent);
  border-radius: var(--yfm-radius);
  padding: 0.4rem 0.6rem;
  font: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.yfm-attachments__download:disabled {
  opacity: 0.6;
  cursor: wait;
}

@media (max-width: 640px) {
  .yfm-attachments__download-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .yfm-attachments__download {
    padding: 0.5rem;
  }
}
</style>
