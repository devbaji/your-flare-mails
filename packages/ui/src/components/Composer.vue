<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  to: string;
  cc?: string;
  subject: string;
  bodyText: string;
  sending?: boolean;
  saving?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  mode?: 'compose' | 'reply' | 'forward';
}>();

const emit = defineEmits<{
  'update:to': [value: string];
  'update:cc': [value: string];
  'update:subject': [value: string];
  'update:bodyText': [value: string];
  save: [];
  send: [];
  discard: [];
  close: [];
}>();

const title = computed(() => {
  if (props.mode === 'reply') return 'Reply';
  if (props.mode === 'forward') return 'Forward';
  return 'New message';
});
</script>

<template>
  <section class="yfm-composer" role="dialog" aria-label="Compose email">
    <header class="yfm-composer__header">
      <h2>{{ title }}</h2>
      <button type="button" class="yfm-composer__close" @click="emit('close')">Close</button>
    </header>

    <label>
      <span>To</span>
      <input
        :value="to"
        type="text"
        autocomplete="off"
        placeholder="alice@example.com"
        @input="emit('update:to', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      <span>Cc</span>
      <input
        :value="cc ?? ''"
        type="text"
        autocomplete="off"
        placeholder="optional"
        @input="emit('update:cc', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      <span>Subject</span>
      <input
        :value="subject"
        type="text"
        autocomplete="off"
        @input="emit('update:subject', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label class="yfm-composer__body">
      <span>Message</span>
      <textarea
        :value="bodyText"
        rows="12"
        @input="emit('update:bodyText', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <p v-if="statusMessage" class="yfm-composer__status">{{ statusMessage }}</p>
    <p v-if="errorMessage" class="yfm-composer__error">{{ errorMessage }}</p>

    <footer class="yfm-composer__actions">
      <button type="button" :disabled="saving || sending" @click="emit('save')">
        {{ saving ? 'Saving…' : 'Save draft' }}
      </button>
      <button type="button" class="yfm-composer__send" :disabled="sending || saving" @click="emit('send')">
        {{ sending ? 'Sending…' : 'Send' }}
      </button>
      <button type="button" class="yfm-composer__discard" :disabled="sending" @click="emit('discard')">
        Discard
      </button>
    </footer>
  </section>
</template>

<style scoped>
.yfm-composer {
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem 1.5rem;
  background: var(--yfm-bg-elevated);
  border-bottom: 1px solid var(--yfm-border);
}

.yfm-composer__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.yfm-composer__header h2 {
  margin: 0;
  font-family: var(--yfm-font-display);
  font-size: 1.25rem;
}

.yfm-composer label {
  display: grid;
  gap: 0.35rem;
}

.yfm-composer label span {
  color: var(--yfm-fg-muted);
  font-size: 0.8rem;
}

.yfm-composer input,
.yfm-composer textarea {
  width: 100%;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg);
  color: inherit;
  border-radius: var(--yfm-radius);
  padding: 0.55rem 0.75rem;
  font: inherit;
}

.yfm-composer textarea {
  resize: vertical;
  min-height: 12rem;
  line-height: 1.5;
}

.yfm-composer__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.yfm-composer__actions button,
.yfm-composer__close {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-muted);
  color: inherit;
  border-radius: var(--yfm-radius);
  padding: 0.45rem 0.85rem;
  font: inherit;
  cursor: pointer;
}

.yfm-composer__send {
  background: var(--yfm-accent) !important;
  color: var(--yfm-accent-fg) !important;
  border-color: transparent !important;
}

.yfm-composer__discard {
  margin-left: auto;
  color: var(--yfm-danger) !important;
}

.yfm-composer__status {
  margin: 0;
  color: var(--yfm-fg-muted);
  font-size: 0.9rem;
}

.yfm-composer__error {
  margin: 0;
  color: var(--yfm-danger);
}
</style>
