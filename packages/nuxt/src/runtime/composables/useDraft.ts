import type { DraftDto } from '@your-flare-mails/api-client';
import { useState } from '#imports';

import { useYfmApi } from './useMailbox.js';

function parseAddressList(raw: string): Array<{ address: string; name?: string }> {
  return raw
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((address) => ({ address }));
}

function formatAddressList(json: string): string {
  try {
    const parsed = JSON.parse(json) as Array<{ address?: string }>;
    if (!Array.isArray(parsed)) return '';
    return parsed
      .map((item) => item.address)
      .filter(Boolean)
      .join(', ');
  } catch {
    return '';
  }
}

export function useDraft() {
  const api = useYfmApi();
  const draft = useState<DraftDto | null>('yfm-compose-draft', () => null);
  const to = useState('yfm-compose-to', () => '');
  const cc = useState('yfm-compose-cc', () => '');
  const subject = useState('yfm-compose-subject', () => '');
  const bodyText = useState('yfm-compose-body', () => '');
  const bodyHtml = useState('yfm-compose-body-html', () => '');
  const mode = useState<'compose' | 'reply' | 'forward'>('yfm-compose-mode', () => 'compose');
  const open = useState('yfm-compose-open', () => false);
  const saving = useState('yfm-compose-saving', () => false);
  const sending = useState('yfm-compose-sending', () => false);
  const statusMessage = useState<string | null>('yfm-compose-status', () => null);
  const errorMessage = useState<string | null>('yfm-compose-error', () => null);

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  function hydrateFromDraft(next: DraftDto, nextMode: 'compose' | 'reply' | 'forward') {
    draft.value = next;
    to.value = formatAddressList(next.toJson);
    cc.value = formatAddressList(next.ccJson);
    subject.value = next.subject ?? '';
    bodyText.value = next.bodyText ?? '';
    bodyHtml.value = next.bodyHtml ?? '';
    mode.value = nextMode;
    open.value = true;
    errorMessage.value = null;
    statusMessage.value = 'Draft loaded';
  }

  async function startCompose(mailboxId: string) {
    const result = await api.createDraft(mailboxId, {
      to: [],
      subject: '',
      bodyText: '',
      bodyHtml: '',
    });
    hydrateFromDraft(result.draft, 'compose');
  }

  async function startReply(messageId: string) {
    const result = await api.createReplyDraft(messageId);
    hydrateFromDraft(result.draft, 'reply');
  }

  async function startForward(messageId: string) {
    const result = await api.createForwardDraft(messageId);
    hydrateFromDraft(result.draft, 'forward');
  }

  async function openExisting(draftId: string) {
    const result = await api.getDraft(draftId);
    hydrateFromDraft(result.draft, 'compose');
  }

  async function save() {
    if (!draft.value) return;
    saving.value = true;
    errorMessage.value = null;
    try {
      const result = await api.updateDraft(draft.value.id, {
        to: parseAddressList(to.value),
        cc: parseAddressList(cc.value),
        subject: subject.value,
        bodyText: bodyText.value,
        bodyHtml: bodyHtml.value || null,
      });
      draft.value = result.draft;
      statusMessage.value = `Saved ${new Date(result.draft.updatedAt).toLocaleTimeString()}`;
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Failed to save draft';
    } finally {
      saving.value = false;
    }
  }

  function scheduleAutosave() {
    if (!draft.value || !open.value) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      void save();
    }, 800);
  }

  async function send() {
    if (!draft.value) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    sending.value = true;
    errorMessage.value = null;
    statusMessage.value = null;
    try {
      await save();
      const result = await api.sendDraft(draft.value.id, {
        to: parseAddressList(to.value),
        cc: parseAddressList(cc.value),
        subject: subject.value,
        bodyText: bodyText.value,
        bodyHtml: bodyHtml.value || undefined,
      });
      if (!result.ok) {
        errorMessage.value = result.error ?? 'Send failed';
        statusMessage.value = 'Message saved as failed send — edit and retry';
        return null;
      }
      statusMessage.value = 'Sent';
      draft.value = null;
      open.value = false;
      return result;
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Send failed';
      return null;
    } finally {
      sending.value = false;
    }
  }

  async function discard() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    if (draft.value) {
      try {
        await api.deleteDraft(draft.value.id);
      } catch {
        // ignore discard errors for missing drafts
      }
    }
    draft.value = null;
    open.value = false;
    statusMessage.value = null;
    errorMessage.value = null;
  }

  function close() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    open.value = false;
  }

  return {
    draft,
    to,
    cc,
    subject,
    bodyText,
    bodyHtml,
    mode,
    open,
    saving,
    sending,
    statusMessage,
    errorMessage,
    startCompose,
    startReply,
    startForward,
    openExisting,
    save,
    scheduleAutosave,
    send,
    discard,
    close,
  };
}

/** Alias matching the framework API name from the master prompt. */
export function useCompose() {
  return useDraft();
}
