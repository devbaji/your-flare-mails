<script setup lang="ts">
import type { DraftDto } from '@your-flare-mails/api-client';
import {
  Composer,
  MailLayout,
  MailSidebar,
  MessageList,
  MessageViewer,
  SearchBar,
  ThreadList,
} from '@your-flare-mails/ui/components';

const brandName = useRuntimeConfig().public.yourFlareMails.brandName as string;
const api = useYfmApi();
const { user, logout, refreshSession, isAuthenticated } = useAuth();

const {
  mailboxes,
  currentId,
  pending: mailboxPending,
  error: mailboxError,
  refresh: refreshMailboxes,
} = useMailbox();

const labelSlug = useState<string>('yfm-active-label', () => 'inbox');
const activeThreadId = useState<string | null>('yfm-active-thread', () => null);
const activeMessageId = useState<string | null>('yfm-active-message', () => null);
const downloadingId = useState<string | null>('yfm-downloading-att', () => null);
const draftUploadError = useState<string | null>('yfm-draft-upload-error', () => null);
const draftUploading = useState('yfm-draft-uploading', () => false);
const composeAttachments = useState<
  Array<{
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }>
>('yfm-compose-attachments', () => []);
const drafts = useState<DraftDto[]>('yfm-drafts-list', () => []);
const draftsPending = useState('yfm-drafts-pending', () => false);
const draftsError = useState<string | null>('yfm-drafts-error', () => null);
const mobilePane = useState<'list' | 'reader'>('yfm-mobile-pane', () => 'list');
const sidebarOpen = useState('yfm-sidebar-open', () => false);
const folderActionPending = useState('yfm-folder-action-pending', () => false);
const folderActionError = useState<string | null>('yfm-folder-action-error', () => null);

const {
  threads,
  pending: threadsPending,
  error: threadsError,
  refresh: refreshThreads,
} = useThreadList(currentId, { label: labelSlug });

const {
  thread,
  messages,
  pending: threadPending,
  error: threadError,
  refresh: refreshThread,
} = useThread(activeThreadId);

const {
  detail,
  pending: messagePending,
  error: messageError,
  refresh: refreshMessage,
} = useMessage(activeMessageId);

const {
  query: searchQuery,
  hits: searchHits,
  pending: searchPending,
  error: searchError,
  active: searchActive,
  search,
  clear: clearSearch,
} = useMailSearch(currentId);

const {
  draft: composeDraft,
  to: composeTo,
  cc: composeCc,
  subject: composeSubject,
  bodyText: composeBody,
  bodyHtml: composeBodyHtml,
  mode: composeMode,
  open: composeOpen,
  saving: composeSaving,
  sending: composeSending,
  statusMessage: composeStatus,
  errorMessage: composeError,
  startCompose,
  startReply,
  startForward,
  openExisting,
  save: saveCompose,
  scheduleAutosave,
  send: sendCompose,
  discard: discardCompose,
  close: closeCompose,
} = useCompose();

const searchText = computed({
  get: () => searchQuery.value.q ?? '',
  set: (value: string) => {
    searchQuery.value = { ...searchQuery.value, q: value };
  },
});

const labels = [
  { slug: 'inbox', name: 'Inbox' },
  { slug: 'sent', name: 'Sent' },
  { slug: 'drafts', name: 'Drafts' },
  { slug: 'archive', name: 'Archive' },
  { slug: 'trash', name: 'Trash' },
];

const isDraftsFolder = computed(() => labelSlug.value === 'drafts' && !searchActive.value);

const viewportCompact = useState('yfm-viewport-compact', () => false);

function updateViewport() {
  if (!import.meta.client) return;
  viewportCompact.value = window.matchMedia('(max-width: 960px)').matches;
}

function selectLabel(slug: string) {
  labelSlug.value = slug;
  clearSearch();
  mobilePane.value = 'list';
  activeThreadId.value = null;
  activeMessageId.value = null;
}

function selectThread(id: string) {
  activeThreadId.value = id;
  mobilePane.value = 'reader';
}

function selectMessage(id: string) {
  activeMessageId.value = id;
}

function selectSearchHit(threadId: string, messageId: string) {
  activeThreadId.value = threadId;
  activeMessageId.value = messageId;
  mobilePane.value = 'reader';
}

function backToList() {
  mobilePane.value = 'list';
}

async function runSearch() {
  await search({ q: searchText.value });
}

async function downloadAttachment(attachmentId: string) {
  downloadingId.value = attachmentId;
  try {
    const { url } = await api.createAttachmentDownloadUrl(attachmentId);
    if (import.meta.client) window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error(err);
  } finally {
    downloadingId.value = null;
  }
}

async function refreshDraftsList() {
  if (!currentId.value) {
    drafts.value = [];
    return;
  }
  draftsPending.value = true;
  draftsError.value = null;
  try {
    const listed = await api.listDrafts(currentId.value);
    drafts.value = listed.drafts;
  } catch (err) {
    draftsError.value = err instanceof Error ? err.message : 'Failed to load drafts';
    drafts.value = [];
  } finally {
    draftsPending.value = false;
  }
}

async function refreshComposeAttachments() {
  if (!composeDraft.value) {
    composeAttachments.value = [];
    return;
  }
  try {
    const listed = await api.listDraftAttachments(composeDraft.value.id);
    composeAttachments.value = listed.attachments.map((item) => ({
      id: item.id,
      filename: item.filename,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
    }));
  } catch {
    composeAttachments.value = [];
  }
}

async function uploadComposeFile(file: File) {
  if (!composeDraft.value) return;
  draftUploading.value = true;
  draftUploadError.value = null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await api.uploadDraftAttachment(composeDraft.value.id, {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes,
    });
    await refreshComposeAttachments();
  } catch (err) {
    draftUploadError.value = err instanceof Error ? err.message : 'Upload failed';
  } finally {
    draftUploading.value = false;
  }
}

async function downloadDraftAttachment(attachmentId: string) {
  const { url } = await api.createDraftAttachmentDownloadUrl(attachmentId);
  if (import.meta.client) window.open(url, '_blank', 'noopener,noreferrer');
}

async function onComposeNew() {
  if (!currentId.value) return;
  await startCompose(currentId.value);
  await refreshComposeAttachments();
}

async function onOpenDraft(draftId: string) {
  await openExisting(draftId);
  await refreshComposeAttachments();
}

async function onReply() {
  if (!activeMessageId.value) return;
  await startReply(activeMessageId.value);
  await refreshComposeAttachments();
}

async function onForward() {
  if (!activeMessageId.value) return;
  await startForward(activeMessageId.value);
  await refreshComposeAttachments();
}

async function onSend() {
  const result = await sendCompose();
  if (result?.ok) {
    composeAttachments.value = [];
    labelSlug.value = 'sent';
    activeThreadId.value = result.threadId;
    activeMessageId.value = result.messageId;
    mobilePane.value = 'reader';
    await refreshThreads();
    await refreshThread();
    await refreshMessage();
  }
  await refreshDraftsList();
}

async function onDiscardCompose() {
  await discardCompose();
  composeAttachments.value = [];
  await refreshDraftsList();
}

async function runFolderAction(action: 'archive' | 'trash' | 'inbox') {
  if (!activeThreadId.value) return;
  folderActionPending.value = true;
  folderActionError.value = null;
  try {
    if (action === 'archive') await api.archiveThread(activeThreadId.value);
    else if (action === 'trash') await api.trashThread(activeThreadId.value);
    else await api.moveThreadToInbox(activeThreadId.value);
    activeThreadId.value = null;
    activeMessageId.value = null;
    mobilePane.value = 'list';
    await refreshThreads();
  } catch (err) {
    folderActionError.value =
      err instanceof Error ? err.message : 'Folder action failed';
  } finally {
    folderActionPending.value = false;
  }
}

watch(currentId, async () => {
  activeThreadId.value = null;
  activeMessageId.value = null;
  clearSearch();
  mobilePane.value = 'list';
  await refreshThreads();
  await refreshDraftsList();
});

watch(labelSlug, async () => {
  activeThreadId.value = null;
  activeMessageId.value = null;
  await refreshThreads();
  if (labelSlug.value === 'drafts') await refreshDraftsList();
});

watch(activeThreadId, async (id) => {
  activeMessageId.value = null;
  if (id) await refreshThread();
});

watch(activeMessageId, async (id) => {
  if (id) await refreshMessage();
});

watch(messages, (list) => {
  if (!activeMessageId.value && list[0]) {
    activeMessageId.value = list[0].id;
  }
});

watch(
  [composeTo, composeCc, composeSubject, composeBody, composeBodyHtml],
  () => {
    scheduleAutosave();
  },
);

watch(composeOpen, async (isOpen) => {
  if (isOpen) await refreshComposeAttachments();
  else composeAttachments.value = [];
});

watch(composeDraft, async (draft) => {
  if (draft && composeOpen.value) await refreshComposeAttachments();
});

const { transport: realtimeTransport, lastEvent: realtimeEvent } =
  useRealtimeMailbox(currentId);
const { notifyFromRealtimeEvent } = useNotifications();

watch(realtimeEvent, async (event) => {
  if (!event || event.type === 'ping') return;
  notifyFromRealtimeEvent(event);
  await refreshThreads();
  if (
    activeThreadId.value &&
    'threadId' in event &&
    event.threadId === activeThreadId.value
  ) {
    await refreshThread();
    if (activeMessageId.value) await refreshMessage();
  }
  if (labelSlug.value === 'drafts') await refreshDraftsList();
});

onMounted(async () => {
  updateViewport();
  window.addEventListener('resize', updateViewport);

  await refreshSession();
  if (!isAuthenticated()) {
    await navigateTo('/login');
    return;
  }
  await refreshMailboxes();
  await refreshThreads();
  await refreshDraftsList();

  await ensurePushRegistration();
});

const pushStatus = useState<string | null>('yfm-push-status', () => null);

async function waitForTauri(timeoutMs = 12000): Promise<boolean> {
  const { isTauri } = useNotifications();
  if (isTauri()) return true;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 250));
    if (isTauri()) return true;
  }
  return isTauri();
}

async function ensurePushRegistration() {
  const { registerPushDevice, detectClientPlatform, isTauri } = useNotifications();
  pushStatus.value = 'checking runtime…';

  const ready = await waitForTauri();
  if (!ready) {
    pushStatus.value = `not tauri (${detectClientPlatform()})`;
    return;
  }

  const mailboxId = currentId.value;
  if (!mailboxId) {
    pushStatus.value = 'waiting for mailbox…';
    return;
  }

  // FCM token / Tauri IPC can lag on cold start — retry generously.
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      pushStatus.value = `registering (${attempt}) · ${detectClientPlatform()}`;
      await registerPushDevice({ mailboxId });
      pushStatus.value = 'push registered';
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[push] registration failed', message, {
        tauri: isTauri(),
        platform: detectClientPlatform(),
      });
      pushStatus.value = message;
      if (attempt < 8) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

function selectLabelAndClose(slug: string) {
  selectLabel(slug);
  sidebarOpen.value = false;
}

watch(currentId, async (id, prev) => {
  if (id && id !== prev) await ensurePushRegistration();
});

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('resize', updateViewport);
});

const currentMailbox = computed(
  () => mailboxes.value.find((mailbox) => mailbox.id === currentId.value) ?? null,
);

const listThreads = computed(() =>
  searchActive.value
    ? searchHits.value.map((hit) => ({
        id: hit.thread.id,
        subject: hit.thread.subject,
        snippet: hit.message.subject || hit.thread.snippet,
        lastMessageAt: hit.message.date,
        isUnread: hit.thread.isUnread,
        messageCount: hit.thread.messageCount,
      }))
    : threads.value,
);

const draftListItems = computed(() =>
  drafts.value.map((draft) => ({
    id: draft.id,
    subject: draft.subject,
    snippet: (draft.bodyText || '').slice(0, 120) || 'Empty draft',
    lastMessageAt: draft.updatedAt,
    isUnread: false,
    messageCount: 0,
  })),
);

const showMoveToInbox = computed(
  () => labelSlug.value === 'archive' || labelSlug.value === 'trash',
);
const showArchive = computed(
  () => labelSlug.value === 'inbox' || labelSlug.value === 'sent',
);
const showTrash = computed(() => labelSlug.value !== 'trash');

const colorMode = useState<'light' | 'dark'>('yfm-color-mode', () => 'light');

function toggleColorMode() {
  const next = colorMode.value === 'dark' ? 'light' : 'dark';
  colorMode.value = next;
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('yfm-color-mode', next);
    } catch {
      // ignore
    }
  }
}
</script>

<template>
  <MailLayout
    :brand-name="brandName"
    :mobile-pane="mobilePane"
    :mobile-nav="viewportCompact"
    v-model:sidebar-open="sidebarOpen"
  >
    <template #header-actions>
      <span v-if="viewportCompact && pushStatus" class="yfm-push-chip" :title="pushStatus">
        {{ pushStatus }}
      </span>
      <button
        type="button"
        class="yfm-theme-toggle"
        :aria-label="colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleColorMode"
      >
        <svg
          v-if="colorMode === 'dark'"
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
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
        <svg
          v-else
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
          <path d="M21 14.5A8.5 8.5 0 1 1 12.5 3a7 7 0 0 0 8.5 11.5z" />
        </svg>
      </button>
    </template>

    <template #sidebar>
      <p v-if="currentMailbox" class="yfm-mail-address">
        {{ currentMailbox.address }}
      </p>
      <button
        type="button"
        class="yfm-compose-btn"
        @click="
          onComposeNew();
          sidebarOpen = false;
        "
      >
        Compose
      </button>
      <MailSidebar
        :labels="labels"
        :active-slug="labelSlug"
        :compact="false"
        @select="selectLabelAndClose"
      />
      <p v-if="user" class="yfm-muted yfm-user">{{ user.email }}</p>
      <button type="button" class="yfm-logout-btn" @click="logout()">Sign out</button>
      <p v-if="mailboxError" class="yfm-error">{{ mailboxError }}</p>
      <p v-if="mailboxPending" class="yfm-muted">Loading mailbox…</p>
      <p class="yfm-muted yfm-realtime">
        Realtime: {{ realtimeTransport }}
        <template v-if="pushStatus"> · Push: {{ pushStatus }}</template>
      </p>
    </template>

    <template #list>
      <SearchBar
        v-model="searchText"
        :loading="searchPending"
        :compact="viewportCompact"
        @submit="runSearch"
        @clear="clearSearch"
      />
      <header class="yfm-pane-header">
        <h2>
          {{
            searchActive
              ? `Search results (${searchHits.length})`
              : (labels.find((l) => l.slug === labelSlug)?.name ?? 'Mail')
          }}
        </h2>
      </header>
      <p v-if="searchError" class="yfm-error">{{ searchError }}</p>
      <p v-if="draftsError && isDraftsFolder" class="yfm-error">{{ draftsError }}</p>
      <p v-if="threadsError && !searchActive && !isDraftsFolder" class="yfm-error">
        {{ threadsError }}
      </p>
      <ThreadList
        v-if="isDraftsFolder"
        :threads="draftListItems"
        :active-id="composeDraft?.id ?? null"
        :loading="draftsPending"
        @select="onOpenDraft"
      />
      <ThreadList
        v-else
        :threads="listThreads"
        :active-id="activeThreadId"
        :loading="searchActive ? searchPending : threadsPending"
        @select="
          (id) => {
            if (searchActive) {
              const hit = searchHits.find((item) => item.thread.id === id);
              if (hit) selectSearchHit(hit.thread.id, hit.message.id);
            } else {
              selectThread(id);
            }
          }
        "
      />
    </template>

    <div class="yfm-reading">
      <header v-if="viewportCompact && mobilePane === 'reader'" class="yfm-mobile-nav">
        <button type="button" class="yfm-back-btn" @click="backToList">Back</button>
      </header>

      <p
        v-if="!activeThreadId && !isDraftsFolder"
        class="yfm-muted yfm-empty"
      >
        Select a conversation
      </p>
      <p v-else-if="isDraftsFolder && !composeOpen" class="yfm-muted yfm-empty">
        Select a draft to continue editing
      </p>
      <template v-else-if="activeThreadId">
        <header class="yfm-pane-header yfm-pane-header--actions">
          <h2>{{ thread?.subject || '(no subject)' }}</h2>
          <div class="yfm-thread-actions">
            <button type="button" :disabled="!activeMessageId" @click="onReply">
              Reply
            </button>
            <button type="button" :disabled="!activeMessageId" @click="onForward">
              Forward
            </button>
            <button
              v-if="showArchive"
              type="button"
              :disabled="folderActionPending"
              @click="runFolderAction('archive')"
            >
              Archive
            </button>
            <button
              v-if="showTrash"
              type="button"
              :disabled="folderActionPending"
              @click="runFolderAction('trash')"
            >
              Trash
            </button>
            <button
              v-if="showMoveToInbox"
              type="button"
              :disabled="folderActionPending"
              @click="runFolderAction('inbox')"
            >
              Move to Inbox
            </button>
          </div>
          <p v-if="folderActionError" class="yfm-error">{{ folderActionError }}</p>
          <p v-if="threadError" class="yfm-error">{{ threadError }}</p>
          <p v-if="threadPending" class="yfm-muted">Loading thread…</p>
        </header>
        <div class="yfm-reading__split">
          <MessageList
            :messages="
              messages.map((message) => ({
                id: message.id,
                fromName: message.fromName,
                fromAddress: message.fromAddress,
                subject: message.subject,
                date: message.date,
                hasAttachments: message.hasAttachments,
              }))
            "
            :active-id="activeMessageId"
            @select="selectMessage"
          />
          <div>
            <p v-if="messageError" class="yfm-error">{{ messageError }}</p>
            <p v-else-if="messagePending" class="yfm-muted">Loading message…</p>
            <MessageViewer
              v-else-if="detail"
              :from-name="detail.message.fromName"
              :from-address="detail.message.fromAddress"
              :subject="detail.message.subject"
              :date="detail.message.date"
              :body-text="detail.bodyText ?? detail.message.bodyText"
              :body-html="detail.bodyHtml ?? null"
              :attachments="detail.attachments"
              :downloading-id="downloadingId"
              @download-attachment="downloadAttachment"
            />
          </div>
        </div>
      </template>
    </div>
  </MailLayout>

  <Composer
    v-if="composeOpen"
    v-model:to="composeTo"
    v-model:cc="composeCc"
    v-model:subject="composeSubject"
    v-model:body-text="composeBody"
    v-model:body-html="composeBodyHtml"
    :mode="composeMode"
    :saving="composeSaving"
    :sending="composeSending"
    :status-message="composeStatus"
    :error-message="composeError"
    :attachments="composeAttachments"
    :uploading="draftUploading"
    :upload-error="draftUploadError"
    @save="saveCompose()"
    @send="onSend"
    @discard="onDiscardCompose"
    @close="closeCompose()"
    @upload="uploadComposeFile"
    @download-attachment="downloadDraftAttachment"
  />
</template>

<style scoped>
.yfm-theme-toggle {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: var(--yfm-fg-muted);
  border-radius: var(--yfm-radius);
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.yfm-push-chip {
  max-width: 7.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.65rem;
  line-height: 1.2;
  color: var(--yfm-fg-muted);
  border: 1px solid var(--yfm-border);
  border-radius: 999px;
  padding: 0.25rem 0.45rem;
}

.yfm-theme-toggle:hover {
  color: var(--yfm-fg);
  border-color: var(--yfm-accent);
}

.yfm-mail-address {
  margin: 0 0 1rem;
  color: var(--yfm-fg-muted);
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.yfm-compose-btn {
  width: 100%;
  margin-bottom: 1rem;
  appearance: none;
  border: 0;
  background: var(--yfm-accent);
  color: var(--yfm-accent-fg);
  border-radius: var(--yfm-radius);
  padding: 0.65rem 0.9rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.yfm-compose-fab {
  width: 2.5rem;
  height: 2.5rem;
  margin: 0 auto 0.75rem;
  display: grid;
  place-items: center;
  appearance: none;
  border: 0;
  background: var(--yfm-accent);
  color: var(--yfm-accent-fg);
  border-radius: 999px;
  cursor: pointer;
}

.yfm-logout-btn {
  width: 100%;
  margin-bottom: 0.75rem;
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: transparent;
  color: inherit;
  border-radius: var(--yfm-radius);
  padding: 0.45rem 0.75rem;
  font: inherit;
  cursor: pointer;
}

.yfm-logout-icon {
  width: 2.25rem;
  height: 2.25rem;
  margin: 0.5rem auto;
  display: grid;
  place-items: center;
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: transparent;
  color: var(--yfm-fg-muted);
  border-radius: var(--yfm-radius);
  cursor: pointer;
}

.yfm-user {
  padding: 0 0 0.5rem !important;
  font-size: 0.8rem;
}

.yfm-pane-header {
  padding: 1rem 1rem 0.5rem;
}

.yfm-pane-header--actions {
  display: grid;
  gap: 0.5rem;
}

.yfm-pane-header h2 {
  margin: 0;
  font-family: var(--yfm-font-display);
  font-size: 1.15rem;
}

.yfm-thread-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.yfm-thread-actions button,
.yfm-back-btn {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: inherit;
  border-radius: var(--yfm-radius);
  padding: 0.35rem 0.7rem;
  font: inherit;
  cursor: pointer;
}

.yfm-mobile-nav {
  padding: 0.65rem 1rem 0;
}

.yfm-reading {
  min-height: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

.yfm-reading__split {
  display: grid;
  grid-template-columns: minmax(0, 16rem) minmax(0, 1fr);
  min-height: calc(100dvh - 8rem);
  max-width: 100%;
}

.yfm-reading__split > :first-child {
  border-right: 1px solid var(--yfm-border);
}

@media (max-width: 960px) {
  .yfm-pane-header {
    padding: 0.65rem 0.75rem 0.35rem;
  }

  .yfm-mobile-nav {
    padding: 0.5rem 0.75rem 0;
  }

  .yfm-muted,
  .yfm-empty {
    padding: 0.75rem;
  }

  .yfm-reading__split {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .yfm-reading__split > :first-child {
    border-right: none;
    border-bottom: 1px solid var(--yfm-border);
  }
}

.yfm-muted,
.yfm-empty {
  color: var(--yfm-fg-muted);
  padding: 1rem;
}

.yfm-realtime {
  padding: 0.5rem 0 0;
  font-size: 0.75rem;
}

.yfm-error {
  color: var(--yfm-danger);
  padding: 0.75rem 1rem;
  margin: 0;
}

@media (max-width: 720px) {
  .yfm-reading__split {
    grid-template-columns: 1fr;
  }

  .yfm-reading__split > :first-child {
    border-right: none;
    border-bottom: 1px solid var(--yfm-border);
    max-height: 10rem;
    overflow: auto;
  }
}
</style>
