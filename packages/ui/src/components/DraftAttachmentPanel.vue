<script setup lang="ts">
const props = defineProps<{
  draftId: string;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }>;
  uploading?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  upload: [file: File];
  download: [attachmentId: string];
}>();

function onPick(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('upload', file);
  input.value = '';
}
</script>

<template>
  <section class="yfm-draft-attachments">
    <header>
      <h3>Draft attachments</h3>
      <p>Upload files onto draft <code>{{ draftId }}</code> (compose UI arrives in Phase 6).</p>
    </header>
    <label class="yfm-draft-attachments__pick">
      <input type="file" :disabled="uploading" @change="onPick" />
      <span>{{ uploading ? 'Uploading…' : 'Choose file' }}</span>
    </label>
    <p v-if="error" class="yfm-draft-attachments__error">{{ error }}</p>
    <ul v-if="attachments.length">
      <li v-for="item in attachments" :key="item.id">
        <span>{{ item.filename }}</span>
        <button type="button" @click="emit('download', item.id)">Download</button>
      </li>
    </ul>
    <p v-else class="yfm-draft-attachments__empty">No files on this draft yet.</p>
  </section>
</template>

<style scoped>
.yfm-draft-attachments {
  padding: 1.25rem 1.5rem;
}

.yfm-draft-attachments header h3 {
  margin: 0 0 0.35rem;
  font-family: var(--yfm-font-display);
}

.yfm-draft-attachments header p {
  margin: 0 0 1rem;
  color: var(--yfm-fg-muted);
  font-size: 0.9rem;
}

.yfm-draft-attachments__pick {
  display: inline-flex;
  cursor: pointer;
}

.yfm-draft-attachments__pick input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.yfm-draft-attachments__pick span {
  border: 1px solid var(--yfm-border);
  background: var(--yfm-accent);
  color: var(--yfm-accent-fg);
  border-radius: var(--yfm-radius);
  padding: 0.5rem 0.9rem;
  font: inherit;
}

.yfm-draft-attachments ul {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.yfm-draft-attachments li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0.75rem;
  background: var(--yfm-bg-muted);
  border-radius: var(--yfm-radius);
}

.yfm-draft-attachments button {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: var(--yfm-accent);
  border-radius: var(--yfm-radius);
  padding: 0.35rem 0.7rem;
  font: inherit;
  cursor: pointer;
}

.yfm-draft-attachments__empty,
.yfm-draft-attachments__error {
  margin: 0.75rem 0 0;
}

.yfm-draft-attachments__error {
  color: var(--yfm-danger);
}
</style>
