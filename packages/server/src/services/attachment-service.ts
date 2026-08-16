import {
  AttachmentRepository,
  DEFAULT_BLOB_URL_TTL_SECONDS,
  MessageRepository,
  R2BlobStore,
  createBlobAccessToken,
  verifyBlobAccessToken,
  type D1Queryable,
  type R2BucketLike,
} from '@your-flare-mails/cloudflare';
import type { Attachment } from '@your-flare-mails/core';

import {
  AuthorizationError,
  NotFoundError,
  requireMailboxAccess,
  type AuthContext,
} from '../auth/context.js';

export type AttachmentServiceDeps = {
  db: D1Queryable;
  r2: R2BucketLike;
  /** HMAC secret used to mint short-lived download tokens (reuse ingest secret in MVP). */
  blobSigningSecret: string;
  /** Public API origin used to build download URLs, e.g. http://127.0.0.1:8787 */
  publicBaseUrl: string;
};

export async function getAttachment(
  deps: AttachmentServiceDeps,
  ctx: AuthContext,
  attachmentId: string,
): Promise<Attachment> {
  const repo = new AttachmentRepository(deps.db);
  const attachment = await repo.findById(attachmentId);
  if (!attachment) throw new NotFoundError('attachment not found');

  const message = await new MessageRepository(deps.db).findById(attachment.messageId);
  if (!message) throw new NotFoundError('message not found');
  await requireMailboxAccess(deps.db, ctx, message.mailboxId);
  return attachment;
}

export async function createAttachmentDownloadUrl(
  deps: AttachmentServiceDeps,
  ctx: AuthContext,
  attachmentId: string,
  ttlSeconds = DEFAULT_BLOB_URL_TTL_SECONDS,
): Promise<{ url: string; expiresAt: string }> {
  const attachment = await getAttachment(deps, ctx, attachmentId);
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await createBlobAccessToken(deps.blobSigningSecret, {
    resourceId: attachment.id,
    r2Key: attachment.r2Key,
    exp,
  });
  const url = new URL(
    `/api/attachments/${attachment.id}/content`,
    deps.publicBaseUrl,
  );
  url.searchParams.set('token', token);
  return { url: url.toString(), expiresAt: new Date(exp * 1000).toISOString() };
}

/**
 * Stream attachment bytes after verifying a short-lived token.
 * Token alone is sufficient (no session cookie) so the URL can be used briefly by the client.
 */
export async function openAttachmentContent(
  deps: AttachmentServiceDeps,
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

  const attachment = await new AttachmentRepository(deps.db).findById(attachmentId);
  if (!attachment || attachment.r2Key !== verified.claims.r2Key) {
    throw new NotFoundError('attachment not found');
  }

  const obj = await new R2BlobStore(deps.r2).getObject(attachment.r2Key);
  if (!obj) throw new NotFoundError('attachment blob missing');

  return {
    body: obj.body,
    contentType: attachment.contentType || obj.contentType,
    filename: attachment.filename,
    size: obj.size,
  };
}
