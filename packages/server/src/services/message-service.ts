import {
  MessageRepository,
  R2BlobStore,
  ThreadRepository,
  AttachmentRepository,
  type D1Queryable,
  type R2BucketLike,
} from '@your-flare-mails/cloudflare';
import type { Attachment, Message, MessageRecipient } from '@your-flare-mails/core';

import {
  NotFoundError,
  requireMailboxAccess,
  type AuthContext,
} from '../auth/context.js';

export type MessageServiceDeps = {
  db: D1Queryable;
  r2?: R2BucketLike;
};

export type MessageDetail = {
  message: Message;
  recipients: MessageRecipient[];
  attachments: Attachment[];
  bodyText: string | null;
};

export async function getMessage(
  deps: MessageServiceDeps,
  ctx: AuthContext,
  messageId: string,
): Promise<MessageDetail> {
  const messages = new MessageRepository(deps.db);
  const message = await messages.findById(messageId);
  if (!message) throw new NotFoundError('message not found');
  await requireMailboxAccess(deps.db, ctx, message.mailboxId);

  let bodyText = message.bodyText;
  if (!bodyText && message.bodyTextR2Key && deps.r2) {
    const blobs = new R2BlobStore(deps.r2);
    const obj = await blobs.getObject(message.bodyTextR2Key);
    if (obj?.body) {
      if (obj.body instanceof ArrayBuffer) {
        bodyText = new TextDecoder().decode(obj.body);
      } else {
        bodyText = await new Response(obj.body).text();
      }
    }
  }

  const [recipients, attachments] = await Promise.all([
    messages.listRecipients(messageId),
    new AttachmentRepository(deps.db).listByMessage(messageId),
  ]);

  return {
    message: { ...message, bodyText },
    recipients,
    attachments,
    bodyText,
  };
}

export async function listThreadMessages(
  deps: MessageServiceDeps,
  ctx: AuthContext,
  threadId: string,
): Promise<Message[]> {
  const thread = await new ThreadRepository(deps.db).findById(threadId);
  if (!thread) throw new NotFoundError('thread not found');
  await requireMailboxAccess(deps.db, ctx, thread.mailboxId);
  return new MessageRepository(deps.db).listByThread(threadId);
}
