<script setup lang="ts">
import {
  DraftAttachmentPanel,
  MailLayout,
  MailSidebar,
  MessageList,
  MessageViewer,
  SearchBar,
  ThreadList,
} from '@your-flare-mails/ui/components';

const brandName = useRuntimeConfig().public.yourFlareMails.brandName as string;
const api = useYfmApi();

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
const draftAttachments = useState<
  Array<{
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }>
>('yfm-draft-attachments', () => []);
const activeDraftId = useState<string | null>('yfm-active-draft', () => null);

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
  { slug: 'work', name: 'Work' },
];

function selectLabel(slug: string) {
  labelSlug.value = slug;
  clearSearch();
}

function selectThread(id: string) {
  activeThreadId.value = id;
}

function selectMessage(id: string) {
  activeMessageId.value = id;
}

function selectSearchHit(threadId: string, messageId: string) {
  activeThreadId.value = threadId;
  activeMessageId.value = messageId;
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

async function refreshDraftPanel() {
  if (!currentId.value || labelSlug.value !== 'drafts') {
    activeDraftId.value = null;
    draftAttachments.value = [];
    return;
  }
  const { drafts } = await api.listDrafts(currentId.value);
  const draft = drafts[0] ?? null;
  activeDraftId.value = draft?.id ?? null;
  if (!draft) {
    draftAttachments.value = [];
    return;
  }
  const listed = await api.listDraftAttachments(draft.id);
  draftAttachments.value = listed.attachments.map((item) => ({
    id: item.id,
    filename: item.filename,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
  }));
}

async function uploadDraftFile(file: File) {
  if (!activeDraftId.value) return;
  draftUploading.value = true;
  draftUploadError.value = null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await api.uploadDraftAttachment(activeDraftId.value, {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes,
    });
    await refreshDraftPanel();
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

watch(currentId, async () => {
  activeThreadId.value = null;
  activeMessageId.value = null;
  clearSearch();
  await refreshThreads();
  await refreshDraftPanel();
});

watch(labelSlug, async () => {
  activeThreadId.value = null;
  activeMessageId.value = null;
  await refreshThreads();
  await refreshDraftPanel();
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

onMounted(async () => {
  await refreshMailboxes();
  await refreshThreads();
  await refreshDraftPanel();
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
</script>

<template>
  <MailLayout :brand-name="brandName">
    <template #sidebar>
      <p v-if="currentMailbox" class="yfm-mail-address">{{ currentMailbox.address }}</p>
      <MailSidebar :labels="labels" :active-slug="labelSlug" @select="selectLabel" />
      <p v-if="mailboxError" class="yfm-error">{{ mailboxError }}</p>
      <p v-if="mailboxPending" class="yfm-muted">Loading mailbox…</p>
    </template>

    <template #list>
      <SearchBar
        v-model="searchText"
        :loading="searchPending"
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
      <p v-if="threadsError && !searchActive" class="yfm-error">{{ threadsError }}</p>
      <ThreadList
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
      <DraftAttachmentPanel
        v-if="labelSlug === 'drafts' && activeDraftId"
        :draft-id="activeDraftId"
        :attachments="draftAttachments"
        :uploading="draftUploading"
        :error="draftUploadError"
        @upload="uploadDraftFile"
        @download="downloadDraftAttachment"
      />

      <p v-else-if="!activeThreadId" class="yfm-muted yfm-empty">Select a conversation</p>
      <template v-else>
        <header class="yfm-pane-header">
          <h2>{{ thread?.subject || '(no subject)' }}</h2>
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
              :attachments="detail.attachments"
              :downloading-id="downloadingId"
              @download-attachment="downloadAttachment"
            />
          </div>
        </div>
      </template>
    </div>
  </MailLayout>
</template>

<style scoped>
.yfm-mail-address {
  margin: 0 0 1rem;
  color: var(--yfm-fg-muted);
  font-size: 0.85rem;
}

.yfm-pane-header {
  padding: 1rem 1rem 0.5rem;
}

.yfm-pane-header h2 {
  margin: 0;
  font-family: var(--yfm-font-display);
  font-size: 1.15rem;
}

.yfm-reading {
  min-height: 100%;
}

.yfm-reading__split {
  display: grid;
  grid-template-columns: minmax(12rem, 16rem) 1fr;
  min-height: calc(100vh - 4rem);
}

.yfm-reading__split > :first-child {
  border-right: 1px solid var(--yfm-border);
}

.yfm-muted,
.yfm-empty {
  color: var(--yfm-fg-muted);
  padding: 1rem;
}

.yfm-error {
  color: var(--yfm-danger);
  padding: 0.75rem 1rem;
  margin: 0;
}
</style>
