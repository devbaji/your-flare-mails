import { MAX_ATTACHMENT_BYTES } from '@your-flare-mails/core';
import {
  DEFAULT_BLOB_URL_TTL_SECONDS,
  DraftAttachmentRepository,
  DraftRepository,
  MessageRepository,
  R2BlobStore,
  createBlobAccessToken,
  newId,
  verifyBlobAccessToken,
  type D1Queryable,
  type DraftAttachmentRow,
  type DraftRow,
  type R2BucketLike,
} from '@your-flare-mails/cloudflare';

import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  requireMailboxAccess,
  type AuthContext,
} from '../auth/context.js';

export type DraftServiceDeps = {
  db: D1Queryable;
  r2: R2BucketLike;
  blobSigningSecret: string;
  publicBaseUrl: string;
};

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return cleaned.slice(0, 180) || 'attachment';
}

export async function listDrafts(
  deps: Pick<DraftServiceDeps, 'db'>,
  ctx: AuthContext,
  mailboxId: string,
): Promise<DraftRow[]> {
  await requireMailboxAccess(deps.db, ctx, mailboxId);
  return new DraftRepository(deps.db).listByMailbox(mailboxId);
}

export async function getDraft(
  deps: Pick<DraftServiceDeps, 'db'>,
  ctx: AuthContext,
  draftId: string,
): Promise<DraftRow> {
  const draft = await new DraftRepository(deps.db).findById(draftId);
  if (!draft) throw new NotFoundError('draft not found');
  await requireMailboxAccess(deps.db, ctx, draft.mailboxId);
  return draft;
}

export type CreateDraftInput = {
  mailboxId: string;
  threadId?: string | null;
  to?: Array<{ address: string; name?: string }>;
  cc?: Array<{ address: string; name?: string }>;
  bcc?: Array<{ address: string; name?: string }>;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  inReplyToMessageId?: string | null;
};

export async function createDraft(
  deps: Pick<DraftServiceDeps, 'db'>,
  ctx: AuthContext,
  input: CreateDraftInput,
): Promise<DraftRow> {
  await requireMailboxAccess(deps.db, ctx, input.mailboxId);
  if (input.inReplyToMessageId) {
    const parent = await new MessageRepository(deps.db).findById(input.inReplyToMessageId);
    if (!parent || parent.mailboxId !== input.mailboxId) {
      throw new NotFoundError('reply parent message not found');
    }
  }
  return new DraftRepository(deps.db).create({
    mailboxId: input.mailboxId,
    threadId: input.threadId ?? null,
    toJson: JSON.stringify(input.to ?? []),
    ccJson: JSON.stringify(input.cc ?? []),
    bccJson: JSON.stringify(input.bcc ?? []),
    subject: input.subject ?? null,
    bodyText: input.bodyText ?? null,
    bodyHtml: input.bodyHtml ?? null,
    inReplyToMessageId: input.inReplyToMessageId ?? null,
    nowIso: new Date().toISOString(),
  });
}

export type UpdateDraftInput = {
  to?: Array<{ address: string; name?: string }>;
  cc?: Array<{ address: string; name?: string }>;
  bcc?: Array<{ address: string; name?: string }>;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  threadId?: string | null;
  inReplyToMessageId?: string | null;
};

export async function updateDraft(
  deps: Pick<DraftServiceDeps, 'db'>,
  ctx: AuthContext,
  draftId: string,
  patch: UpdateDraftInput,
): Promise<DraftRow> {
  await getDraft(deps, ctx, draftId);
  const updateInput: {
    threadId?: string | null;
    toJson?: string;
    ccJson?: string;
    bccJson?: string;
    subject?: string | null;
    bodyText?: string | null;
    bodyHtml?: string | null;
    inReplyToMessageId?: string | null;
    nowIso: string;
  } = { nowIso: new Date().toISOString() };
  if (patch.to) updateInput.toJson = JSON.stringify(patch.to);
  if (patch.cc) updateInput.ccJson = JSON.stringify(patch.cc);
  if (patch.bcc) updateInput.bccJson = JSON.stringify(patch.bcc);
  if (patch.subject !== undefined) updateInput.subject = patch.subject;
  if (patch.bodyText !== undefined) updateInput.bodyText = patch.bodyText;
  if (patch.bodyHtml !== undefined) updateInput.bodyHtml = patch.bodyHtml;
  if (patch.threadId !== undefined) updateInput.threadId = patch.threadId;
  if (patch.inReplyToMessageId !== undefined) {
    updateInput.inReplyToMessageId = patch.inReplyToMessageId;
  }
  const updated = await new DraftRepository(deps.db).update(draftId, updateInput);
  if (!updated) throw new NotFoundError('draft not found');
  return updated;
}

export async function deleteDraft(
  deps: Pick<DraftServiceDeps, 'db'>,
  ctx: AuthContext,
  draftId: string,
): Promise<void> {
  await getDraft(deps, ctx, draftId);
  await new DraftRepository(deps.db).delete(draftId);
}

/** Create a reply draft prefilled from an existing message. */
export async function createReplyDraft(
  deps: Pick<DraftServiceDeps, 'db'>,
  ctx: AuthContext,
  messageId: string,
): Promise<DraftRow> {
  const message = await new MessageRepository(deps.db).findById(messageId);
  if (!message) throw new NotFoundError('message not found');
  await requireMailboxAccess(deps.db, ctx, message.mailboxId);

  const recipients = await new MessageRepository(deps.db).listRecipients(messageId);

  const to =
    message.direction === 'inbound'
      ? [
          {
            address: message.fromAddress,
            ...(message.fromName ? { name: message.fromName } : {}),
          },
        ]
      : recipients
          .filter((r) => r.type === 'to')
          .map((r) => ({
            address: r.address,
            ...(r.name ? { name: r.name } : {}),
          }));

  const subject = message.subject?.match(/^re:/i)
    ? message.subject
    : `Re: ${message.subject || '(no subject)'}`;

  return createDraft(deps, ctx, {
    mailboxId: message.mailboxId,
    threadId: message.threadId,
    to,
    subject,
    bodyText: `\n\nOn ${message.date}, ${message.fromName || message.fromAddress} wrote:\n> ${(message.bodyText ?? '').split('\n').join('\n> ')}`,
    inReplyToMessageId: message.id,
  });
}

/** Create a forward draft prefilled from an existing message. */
export async function createForwardDraft(
  deps: Pick<DraftServiceDeps, 'db'>,
  ctx: AuthContext,
  messageId: string,
): Promise<DraftRow> {
  const message = await new MessageRepository(deps.db).findById(messageId);
  if (!message) throw new NotFoundError('message not found');
  await requireMailboxAccess(deps.db, ctx, message.mailboxId);

  const subject = message.subject?.match(/^fwd:/i)
    ? message.subject
    : `Fwd: ${message.subject || '(no subject)'}`;

  return createDraft(deps, ctx, {
    mailboxId: message.mailboxId,
    to: [],
    subject,
    bodyText: `\n\n---------- Forwarded message ----------\nFrom: ${message.fromAddress}\nDate: ${message.date}\nSubject: ${message.subject || '(no subject)'}\n\n${message.bodyText ?? ''}`,
  });
}

export async function listDraftAttachments(
  deps: Pick<DraftServiceDeps, 'db'>,
  ctx: AuthContext,
  draftId: string,
): Promise<DraftAttachmentRow[]> {
  await getDraft(deps, ctx, draftId);
  return new DraftAttachmentRepository(deps.db).listByDraft(draftId);
}

export async function uploadDraftAttachment(
  deps: DraftServiceDeps,
  ctx: AuthContext,
  draftId: string,
  input: {
    filename: string;
    contentType: string;
    bytes: Uint8Array;
  },
): Promise<DraftAttachmentRow> {
  const draft = await getDraft(deps, ctx, draftId);
  if (input.bytes.byteLength === 0) {
    throw new ValidationError('empty attachment body');
  }
  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError(
      `attachment exceeds MAX_ATTACHMENT_BYTES (${MAX_ATTACHMENT_BYTES})`,
    );
  }

  const filename = sanitizeFilename(input.filename);
  const contentType = input.contentType.trim() || 'application/octet-stream';
  const checksum = `sha256:${await sha256Hex(input.bytes)}`;
  const attachmentId = newId('datt');
  const r2Key = `mailboxes/${draft.mailboxId}/drafts/${draft.id}/${attachmentId}-${filename}`;
  const nowIso = new Date().toISOString();

  await new R2BlobStore(deps.r2).putBytes(r2Key, input.bytes, contentType);

  return new DraftAttachmentRepository(deps.db).insert({
    id: attachmentId,
    draftId: draft.id,
    filename,
    contentType,
    sizeBytes: input.bytes.byteLength,
    checksum,
    r2Key,
    nowIso,
  });
}

export async function createDraftAttachmentDownloadUrl(
  deps: DraftServiceDeps,
  ctx: AuthContext,
  attachmentId: string,
  ttlSeconds = DEFAULT_BLOB_URL_TTL_SECONDS,
): Promise<{ url: string; expiresAt: string }> {
  const attachment = await new DraftAttachmentRepository(deps.db).findById(attachmentId);
  if (!attachment) throw new NotFoundError('draft attachment not found');
  await getDraft(deps, ctx, attachment.draftId);

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await createBlobAccessToken(deps.blobSigningSecret, {
    resourceId: attachment.id,
    r2Key: attachment.r2Key,
    exp,
  });
  const url = new URL(
    `/api/draft-attachments/${attachment.id}/content`,
    deps.publicBaseUrl,
  );
  url.searchParams.set('token', token);
  return { url: url.toString(), expiresAt: new Date(exp * 1000).toISOString() };
}

export async function openDraftAttachmentContent(
  deps: DraftServiceDeps,
  attachmentId: string,
  token: string,
): Promise<{
  body: ReadableStream | ArrayBuffer;
  contentType: string;
  filename: string;
  size: number;
}> {
  const verified = await verifyBlobAccessToken(deps.blobSigningSecret, token);
  if (!verified.ok) {
    throw new AuthorizationError(`invalid blob token: ${verified.reason}`);
  }
  if (verified.claims.resourceId !== attachmentId) {
    throw new AuthorizationError('token resource mismatch');
  }

  const attachment = await new DraftAttachmentRepository(deps.db).findById(attachmentId);
  if (!attachment || attachment.r2Key !== verified.claims.r2Key) {
    throw new NotFoundError('draft attachment blob missing');
  }

  const obj = await new R2BlobStore(deps.r2).getObject(attachment.r2Key);
  if (!obj) throw new NotFoundError('draft attachment blob missing');

  return {
    body: obj.body,
    contentType: attachment.contentType || obj.contentType,
    filename: attachment.filename,
    size: obj.size,
  };
}
