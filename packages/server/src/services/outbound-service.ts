import {
  EmailAddressSchema,
  OutboundAddressSchema,
  computeMessageFingerprint,
  type MailTransport,
  type MailboxRealtimeEvent,
  type OutboundAddress,
} from '@your-flare-mails/core';
import {
  DraftAttachmentRepository,
  DraftRepository,
  MailboxRepository,
  MessageRepository,
  OutboundRepository,
  newId,
  type D1Queryable,
  type R2BucketLike,
} from '@your-flare-mails/cloudflare';

import { NotFoundError, ValidationError, type AuthContext } from '../auth/context.js';
import { getDraft } from './draft-service.js';

export type OutboundServiceDeps = {
  db: D1Queryable;
  r2: R2BucketLike;
  transport: MailTransport;
  /** Best-effort realtime fan-out (Phase 7). Must not throw into send. */
  notifyMailbox?: (event: MailboxRealtimeEvent) => Promise<void>;
};

type SendDraftOverrides = {
  to?: OutboundAddress[];
  cc?: OutboundAddress[];
  bcc?: OutboundAddress[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
};

function parseRecipientsJson(raw: string): OutboundAddress[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: OutboundAddress[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const address = (item as { address?: unknown }).address;
      const name = (item as { name?: unknown }).name;
      if (typeof address !== 'string' || !EmailAddressSchema.safeParse(address).success) {
        continue;
      }
      const recipient: OutboundAddress = { address: address.toLowerCase() };
      if (typeof name === 'string' && name) recipient.name = name;
      out.push(recipient);
    }
    return out;
  } catch {
    return [];
  }
}

function parseOverrides(raw: unknown): SendDraftOverrides {
  if (!raw || typeof raw !== 'object') return {};
  const body = raw as Record<string, unknown>;
  const overrides: SendDraftOverrides = {};
  if (body.to !== undefined) {
    const parsed = OutboundAddressSchema.array().safeParse(body.to);
    if (!parsed.success) throw new ValidationError('invalid send payload');
    overrides.to = parsed.data;
  }
  if (body.cc !== undefined) {
    const parsed = OutboundAddressSchema.array().safeParse(body.cc);
    if (!parsed.success) throw new ValidationError('invalid send payload');
    overrides.cc = parsed.data;
  }
  if (body.bcc !== undefined) {
    const parsed = OutboundAddressSchema.array().safeParse(body.bcc);
    if (!parsed.success) throw new ValidationError('invalid send payload');
    overrides.bcc = parsed.data;
  }
  if (typeof body.subject === 'string') overrides.subject = body.subject;
  if (typeof body.bodyText === 'string') overrides.bodyText = body.bodyText;
  if (typeof body.bodyHtml === 'string') overrides.bodyHtml = body.bodyHtml;
  return overrides;
}

function formatMessageId(local: string, domain: string): string {
  return `<${local}@${domain}>`;
}

function domainFromAddress(address: string): string {
  const at = address.lastIndexOf('@');
  return at >= 0 ? address.slice(at + 1) : 'localhost';
}

export type SendDraftResult =
  | {
      ok: true;
      messageId: string;
      threadId: string;
      mailboxId: string;
      providerMessageId?: string;
    }
  | {
      ok: false;
      messageId: string;
      threadId: string;
      mailboxId: string;
      error: string;
    };

/**
 * Send a draft: authorize → persist outbound message (sending) → transport →
 * mark sent/failed → delete draft on success.
 */
export async function sendDraft(
  deps: OutboundServiceDeps,
  ctx: AuthContext,
  draftId: string,
  overridesRaw: unknown = {},
): Promise<SendDraftResult> {
  const overrides = parseOverrides(overridesRaw);

  const draft = await getDraft(deps, ctx, draftId);
  const mailbox = await new MailboxRepository(deps.db).findById(draft.mailboxId);
  if (!mailbox) throw new NotFoundError('mailbox not found');

  const to = overrides.to ?? parseRecipientsJson(draft.toJson);
  const cc = overrides.cc ?? parseRecipientsJson(draft.ccJson);
  const bcc = overrides.bcc ?? parseRecipientsJson(draft.bccJson);
  const subject = overrides.subject !== undefined ? overrides.subject : (draft.subject ?? '');
  const bodyText =
    overrides.bodyText !== undefined ? overrides.bodyText : (draft.bodyText ?? '');
  const bodyHtml =
    overrides.bodyHtml !== undefined ? overrides.bodyHtml : draft.bodyHtml;

  if (to.length === 0) {
    throw new ValidationError('at least one To recipient is required');
  }
  if (!subject.trim() && !bodyText.trim() && !bodyHtml?.trim()) {
    throw new ValidationError('subject or body is required');
  }

  let inReplyToHeader: string | null = null;
  let referencesHeader: string | null = null;
  let threadId = draft.threadId;

  if (draft.inReplyToMessageId) {
    const parent = await new MessageRepository(deps.db).findById(draft.inReplyToMessageId);
    if (parent && parent.mailboxId === draft.mailboxId) {
      inReplyToHeader = parent.messageIdHeader;
      const prior = parent.referencesHeader?.trim();
      referencesHeader = [prior, parent.messageIdHeader].filter(Boolean).join(' ').trim() || null;
      threadId = parent.threadId;
    }
  }

  if (!threadId) {
    threadId = newId('thr');
  }

  const nowIso = new Date().toISOString();
  const messageId = newId('msg');
  const messageIdHeader = formatMessageId(
    messageId.replace(/^msg_/, ''),
    domainFromAddress(mailbox.address),
  );
  const fingerprint = await computeMessageFingerprint({
    messageIdHeader,
    envelopeRecipients: to.map((r) => r.address),
    contentMaterial: `${subject}\n${bodyText}`,
  });

  const recipientsText = [...to, ...cc].map((r) => r.address).join(' ');
  const attachments = await new DraftAttachmentRepository(deps.db).listByDraft(draft.id);
  const outbound = new OutboundRepository(deps.db);
  const labelSentId = await outbound.findLabelId(draft.mailboxId, 'sent');

  const toRecipients = to.map((r) => {
    const item: { address: string; name?: string } = { address: r.address };
    if (r.name) item.name = r.name;
    return item;
  });
  const ccRecipients = cc.map((r) => {
    const item: { address: string; name?: string } = { address: r.address };
    if (r.name) item.name = r.name;
    return item;
  });
  const bccRecipients = bcc.map((r) => {
    const item: { address: string; name?: string } = { address: r.address };
    if (r.name) item.name = r.name;
    return item;
  });

  await outbound.persistOutbound({
    mailboxId: draft.mailboxId,
    threadId,
    messageId,
    fingerprint,
    messageIdHeader,
    inReplyTo: inReplyToHeader,
    referencesHeader,
    fromAddress: mailbox.address,
    fromName: mailbox.displayName,
    subject: subject || null,
    date: nowIso,
    bodyText: bodyText || null,
    recipientsText,
    to: toRecipients,
    cc: ccRecipients,
    bcc: bccRecipients,
    hasAttachments: attachments.length > 0,
    rawMimeR2Key: null,
    nowIso,
    labelSentId,
    status: 'sending',
  });

  for (const attachment of attachments) {
    await outbound.attachDraftAttachmentToMessage({
      messageId,
      filename: attachment.filename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      checksum: attachment.checksum,
      r2Key: attachment.r2Key,
      nowIso,
    });
  }

  const sendPayload = {
    from: {
      address: mailbox.address,
      ...(mailbox.displayName ? { name: mailbox.displayName } : {}),
    },
    to,
    subject: subject || '(no subject)',
    messageId: messageIdHeader,
    ...(cc.length ? { cc } : {}),
    ...(bcc.length ? { bcc } : {}),
    ...(bodyText ? { text: bodyText } : {}),
    ...(bodyHtml ? { html: bodyHtml } : {}),
    ...(inReplyToHeader ? { inReplyTo: inReplyToHeader } : {}),
    ...(referencesHeader ? { references: referencesHeader } : {}),
  };

  const sendResult = await deps.transport.send(sendPayload);

  if (!sendResult.ok) {
    await outbound.updateMessageStatus(messageId, 'failed', new Date().toISOString());
    return {
      ok: false,
      messageId,
      threadId,
      mailboxId: draft.mailboxId,
      error: sendResult.error ?? 'send failed',
    };
  }

  const sentAt = new Date().toISOString();
  await outbound.updateMessageStatus(messageId, 'sent', sentAt);
  await new DraftRepository(deps.db).delete(draft.id);

  if (deps.notifyMailbox) {
    try {
      await deps.notifyMailbox({
        type: 'message.sent',
        mailboxId: draft.mailboxId,
        messageId,
        threadId,
        at: sentAt,
      });
    } catch {
      // Realtime is best-effort; send already succeeded.
    }
  }

  const success: SendDraftResult = {
    ok: true,
    messageId,
    threadId,
    mailboxId: draft.mailboxId,
  };
  if (sendResult.providerMessageId) {
    success.providerMessageId = sendResult.providerMessageId;
  }
  return success;
}
