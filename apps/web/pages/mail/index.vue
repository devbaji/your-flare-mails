<script setup lang="ts">
import {
  MailLayout,
  MailSidebar,
  MessageList,
  MessageViewer,
  ThreadList,
} from '@your-flare-mails/ui/components';

const brandName = useRuntimeConfig().public.yourFlareMails.brandName as string;

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
}

function selectThread(id: string) {
  activeThreadId.value = id;
}

function selectMessage(id: string) {
  activeMessageId.value = id;
}

watch(currentId, async () => {
  activeThreadId.value = null;
  activeMessageId.value = null;
  await refreshThreads();
});

watch(labelSlug, async () => {
  activeThreadId.value = null;
  activeMessageId.value = null;
  await refreshThreads();
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
});

const currentMailbox = computed(
  () => mailboxes.value.find((mailbox) => mailbox.id === currentId.value) ?? null,
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
      <header class="yfm-pane-header">
        <h2>{{ labels.find((l) => l.slug === labelSlug)?.name ?? 'Mail' }}</h2>
      </header>
      <p v-if="threadsError" class="yfm-error">{{ threadsError }}</p>
      <ThreadList
        :threads="threads"
        :active-id="activeThreadId"
        :loading="threadsPending"
        @select="selectThread"
      />
    </template>

    <div class="yfm-reading">
      <p v-if="!activeThreadId" class="yfm-muted yfm-empty">Select a conversation</p>
      <template v-else>
        <header class="yfm-pane-header">
          <h2>{{ thread?.subject || '(no subject)' }}</h2>
          <p v-if="threadError" class="yfm-error">{{ threadError }}</p>
          <p v-if="threadPending" class="yfm-muted">Loading thread…</p>
        </header>
        <div class="yfm-reading__split">
          <MessageList
            :messages="messages"
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
