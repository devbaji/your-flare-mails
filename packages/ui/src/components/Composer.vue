<script setup lang="ts">
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

export type ComposerAttachment = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

const props = defineProps<{
  to: string;
  cc?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  sending?: boolean;
  saving?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  mode?: 'compose' | 'reply' | 'forward';
  attachments?: ComposerAttachment[];
  uploading?: boolean;
  uploadError?: string | null;
}>();

const emit = defineEmits<{
  'update:to': [value: string];
  'update:cc': [value: string];
  'update:subject': [value: string];
  'update:bodyText': [value: string];
  'update:bodyHtml': [value: string];
  save: [];
  send: [];
  discard: [];
  close: [];
  upload: [file: File];
  downloadAttachment: [attachmentId: string];
}>();

const minimized = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const title = computed(() => {
  if (props.mode === 'reply') return 'Reply';
  if (props.mode === 'forward') return 'Forward';
  return 'New message';
});

function initialContent(): string {
  if (props.bodyHtml?.trim()) return props.bodyHtml;
  if (props.bodyText?.trim()) {
    return props.bodyText
      .split(/\n{2,}/)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
  return '<p></p>';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
  ],
  content: initialContent(),
  editorProps: {
    attributes: {
      class: 'yfm-composer__editor',
      'aria-label': 'Message body',
    },
  },
  onUpdate: ({ editor: ed }) => {
    emit('update:bodyHtml', ed.getHTML());
    emit('update:bodyText', ed.getText());
  },
});

watch(
  () => [props.bodyHtml, props.bodyText] as const,
  ([html, text], [prevHtml, prevText]) => {
    if (!editor.value) return;
    if (html === prevHtml && text === prevText) return;
    const currentHtml = editor.value.getHTML();
    const next = html?.trim()
      ? html
      : text?.trim()
        ? text
            .split(/\n{2,}/)
            .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
            .join('')
        : '<p></p>';
    // Avoid clobbering in-progress edits when the prop echo matches editor HTML.
    if (html && html === currentHtml) return;
    if (next !== currentHtml) {
      editor.value.commands.setContent(next, false);
    }
  },
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});

function setLink() {
  if (!editor.value) return;
  const previous = editor.value.getAttributes('link').href as string | undefined;
  const url = window.prompt('Link URL', previous ?? 'https://');
  if (url === null) return;
  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

function onPickFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('upload', file);
  input.value = '';
}
</script>

<template>
  <section
    class="yfm-composer"
    :class="{ 'is-minimized': minimized }"
    role="dialog"
    aria-label="Compose email"
  >
    <header class="yfm-composer__header">
      <h2>{{ title }}</h2>
      <div class="yfm-composer__header-actions">
        <button
          type="button"
          class="yfm-composer__icon-btn"
          :aria-label="minimized ? 'Expand compose' : 'Minimize compose'"
          @click="minimized = !minimized"
        >
          {{ minimized ? '▴' : '▾' }}
        </button>
        <button
          type="button"
          class="yfm-composer__icon-btn"
          aria-label="Close compose"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
    </header>

    <div v-show="!minimized" class="yfm-composer__body-wrap">
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

      <div class="yfm-composer__toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          :class="{ 'is-active': editor?.isActive('bold') }"
          :disabled="!editor"
          aria-label="Bold"
          @click="editor?.chain().focus().toggleBold().run()"
        >
          B
        </button>
        <button
          type="button"
          :class="{ 'is-active': editor?.isActive('italic') }"
          :disabled="!editor"
          aria-label="Italic"
          @click="editor?.chain().focus().toggleItalic().run()"
        >
          I
        </button>
        <button
          type="button"
          :class="{ 'is-active': editor?.isActive('bulletList') }"
          :disabled="!editor"
          aria-label="Bullet list"
          @click="editor?.chain().focus().toggleBulletList().run()"
        >
          • List
        </button>
        <button
          type="button"
          :class="{ 'is-active': editor?.isActive('orderedList') }"
          :disabled="!editor"
          aria-label="Numbered list"
          @click="editor?.chain().focus().toggleOrderedList().run()"
        >
          1. List
        </button>
        <button
          type="button"
          :class="{ 'is-active': editor?.isActive('blockquote') }"
          :disabled="!editor"
          aria-label="Quote"
          @click="editor?.chain().focus().toggleBlockquote().run()"
        >
          “ ”
        </button>
        <button
          type="button"
          :class="{ 'is-active': editor?.isActive('link') }"
          :disabled="!editor"
          aria-label="Link"
          @click="setLink"
        >
          Link
        </button>
      </div>

      <EditorContent :editor="editor" class="yfm-composer__editor-shell" />

      <div class="yfm-composer__attachments">
        <div class="yfm-composer__attach-row">
          <button
            type="button"
            class="yfm-composer__attach-btn"
            :disabled="uploading || sending"
            @click="fileInput?.click()"
          >
            {{ uploading ? 'Uploading…' : 'Attach file' }}
          </button>
          <input
            ref="fileInput"
            type="file"
            class="yfm-composer__file"
            :disabled="uploading || sending"
            @change="onPickFile"
          />
        </div>
        <p v-if="uploadError" class="yfm-composer__error">{{ uploadError }}</p>
        <ul v-if="attachments?.length" class="yfm-composer__attach-list">
          <li v-for="item in attachments" :key="item.id">
            <button type="button" @click="emit('downloadAttachment', item.id)">
              <strong>{{ item.filename }}</strong>
              <span>{{ formatSize(item.sizeBytes) }}</span>
            </button>
          </li>
        </ul>
      </div>

      <p v-if="statusMessage" class="yfm-composer__status">{{ statusMessage }}</p>
      <p v-if="errorMessage" class="yfm-composer__error">{{ errorMessage }}</p>

      <footer class="yfm-composer__actions">
        <button
          type="button"
          class="yfm-composer__send"
          :disabled="sending || saving"
          @click="emit('send')"
        >
          {{ sending ? 'Sending…' : 'Send' }}
        </button>
        <button type="button" :disabled="saving || sending" @click="emit('save')">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          class="yfm-composer__discard"
          :disabled="sending"
          @click="emit('discard')"
        >
          Discard
        </button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.yfm-composer {
  position: fixed;
  right: 1rem;
  bottom: 0;
  z-index: 40;
  width: min(36rem, calc(100vw - 1.5rem));
  display: grid;
  background: var(--yfm-bg-elevated);
  border: 1px solid var(--yfm-border);
  border-bottom: 0;
  border-radius: var(--yfm-radius) var(--yfm-radius) 0 0;
  box-shadow: 0 -8px 32px rgba(20, 32, 28, 0.18);
  max-height: min(36rem, calc(100vh - 4rem));
}

.yfm-composer.is-minimized {
  max-height: none;
}

.yfm-composer__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 0.85rem;
  background: color-mix(in srgb, var(--yfm-fg) 88%, var(--yfm-accent));
  color: var(--yfm-bg-elevated);
  border-radius: var(--yfm-radius) var(--yfm-radius) 0 0;
  cursor: default;
}

.yfm-composer__header h2 {
  margin: 0;
  font-family: var(--yfm-font-display);
  font-size: 0.95rem;
  font-weight: 600;
}

.yfm-composer__header-actions {
  display: flex;
  gap: 0.25rem;
}

.yfm-composer__icon-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font: inherit;
  line-height: 1;
}

.yfm-composer__icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.yfm-composer__body-wrap {
  display: grid;
  gap: 0.55rem;
  padding: 0.75rem 0.85rem 0.9rem;
  overflow: auto;
  max-height: min(32rem, calc(100vh - 7rem));
}

.yfm-composer label {
  display: grid;
  grid-template-columns: 3.5rem 1fr;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--yfm-border);
  padding-bottom: 0.35rem;
}

.yfm-composer label span {
  color: var(--yfm-fg-muted);
  font-size: 0.8rem;
}

.yfm-composer input {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0.25rem 0;
  font: inherit;
  outline: none;
}

.yfm-composer__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.yfm-composer__toolbar button {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-muted);
  color: inherit;
  border-radius: 0.35rem;
  padding: 0.25rem 0.5rem;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.yfm-composer__toolbar button.is-active {
  background: color-mix(in srgb, var(--yfm-accent) 22%, transparent);
  border-color: var(--yfm-accent);
}

.yfm-composer__editor-shell {
  min-height: 10rem;
  border: 1px solid var(--yfm-border);
  border-radius: var(--yfm-radius);
  background: var(--yfm-bg);
  padding: 0.55rem 0.65rem;
}

.yfm-composer__editor-shell :deep(.yfm-composer__editor) {
  min-height: 9rem;
  outline: none;
  font: inherit;
  line-height: 1.5;
}

.yfm-composer__editor-shell :deep(.yfm-composer__editor p) {
  margin: 0 0 0.65rem;
}

.yfm-composer__editor-shell :deep(.yfm-composer__editor ul),
.yfm-composer__editor-shell :deep(.yfm-composer__editor ol) {
  margin: 0 0 0.65rem;
  padding-left: 1.25rem;
}

.yfm-composer__editor-shell :deep(.yfm-composer__editor blockquote) {
  margin: 0 0 0.65rem;
  padding-left: 0.75rem;
  border-left: 3px solid var(--yfm-border);
  color: var(--yfm-fg-muted);
}

.yfm-composer__attachments {
  display: grid;
  gap: 0.4rem;
}

.yfm-composer__file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.yfm-composer__attach-btn,
.yfm-composer__actions button {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-muted);
  color: inherit;
  border-radius: var(--yfm-radius);
  padding: 0.4rem 0.75rem;
  font: inherit;
  cursor: pointer;
}

.yfm-composer__attach-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.yfm-composer__attach-list button {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-muted);
  color: inherit;
  border-radius: 999px;
  padding: 0.3rem 0.65rem;
  font: inherit;
  cursor: pointer;
  display: inline-flex;
  gap: 0.4rem;
  align-items: baseline;
}

.yfm-composer__attach-list span {
  color: var(--yfm-fg-muted);
  font-size: 0.75rem;
}

.yfm-composer__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.yfm-composer__send {
  background: var(--yfm-accent) !important;
  color: var(--yfm-accent-fg) !important;
  border-color: transparent !important;
  font-weight: 600;
}

.yfm-composer__discard {
  margin-left: auto;
  color: var(--yfm-danger) !important;
  background: transparent !important;
  border-color: transparent !important;
}

.yfm-composer__status {
  margin: 0;
  color: var(--yfm-fg-muted);
  font-size: 0.85rem;
}

.yfm-composer__error {
  margin: 0;
  color: var(--yfm-danger);
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .yfm-composer {
    right: 0;
    left: 0;
    width: 100%;
    border-radius: var(--yfm-radius) var(--yfm-radius) 0 0;
  }
}
</style>
