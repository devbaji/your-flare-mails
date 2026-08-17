<script setup lang="ts">
import { computed } from 'vue';

import { sanitizeEmailHtml } from '../sanitize.js';
import AttachmentList, { type AttachmentListItem } from './AttachmentList.vue';

const props = defineProps<{
  fromName?: string | null;
  fromAddress: string;
  subject?: string | null;
  date: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  attachments?: AttachmentListItem[];
  downloadingId?: string | null;
}>();

defineEmits<{
  downloadAttachment: [attachmentId: string];
}>();

const safeHtml = computed(() =>
  props.bodyHtml ? sanitizeEmailHtml(props.bodyHtml) : null,
);
</script>

<template>
  <article class="yfm-viewer">
    <header>
      <h1>{{ subject || '(no subject)' }}</h1>
      <p>
        <strong>{{ fromName || fromAddress }}</strong>
        <span>&lt;{{ fromAddress }}&gt;</span>
      </p>
      <time>{{ new Date(date).toLocaleString() }}</time>
    </header>

    <iframe
      v-if="safeHtml"
      class="yfm-viewer__html"
      title="Email HTML body"
      sandbox=""
      referrerpolicy="no-referrer"
      :srcdoc="safeHtml"
    />
    <pre v-else-if="bodyText" class="yfm-viewer__text">{{ bodyText }}</pre>
    <p v-else class="yfm-viewer__empty">No message body</p>

    <AttachmentList
      v-if="attachments?.length"
      :attachments="attachments"
      :downloading-id="downloadingId"
      @download="$emit('downloadAttachment', $event)"
    />
  </article>
</template>

<style scoped>
.yfm-viewer {
  padding: 1.5rem;
}

@media (max-width: 960px) {
  .yfm-viewer {
    padding: 0.75rem 0.85rem 1.25rem;
  }

  .yfm-viewer h1 {
    font-size: 1.25rem;
  }

  .yfm-viewer header {
    margin-bottom: 0.85rem;
    padding-bottom: 0.75rem;
  }
}

.yfm-viewer header {
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--yfm-border);
}

.yfm-viewer h1 {
  margin: 0 0 0.5rem;
  font-family: var(--yfm-font-display);
  font-size: 1.6rem;
  letter-spacing: -0.02em;
}

.yfm-viewer p {
  margin: 0.15rem 0;
  color: var(--yfm-fg-muted);
}

.yfm-viewer time {
  font-size: 0.85rem;
  color: var(--yfm-fg-muted);
}

.yfm-viewer__text {
  white-space: pre-wrap;
  font-family: var(--yfm-font-sans);
  line-height: 1.55;
  margin: 0;
}

.yfm-viewer__html {
  width: 100%;
  min-height: 24rem;
  border: 1px solid var(--yfm-border);
  border-radius: var(--yfm-radius);
  background: #fff;
}

.yfm-viewer__empty {
  color: var(--yfm-fg-muted);
}
</style>
