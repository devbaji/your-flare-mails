import { MAX_ATTACHMENT_BYTES } from '@your-flare-mails/core';
import {
  DEFAULT_BLOB_URL_TTL_SECONDS,
  DraftAttachmentRepository,
  DraftRepository,
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
    throw new NotFoundError('draft attachment not found');
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
