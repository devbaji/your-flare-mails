import {
  MailboxRepository,
  type D1Queryable,
} from '@your-flare-mails/cloudflare';
import type { Mailbox } from '@your-flare-mails/core';

import {
  NotFoundError,
  requireMailboxAccess,
  type AuthContext,
} from '../auth/context.js';

export type MailboxServiceDeps = {
  db: D1Queryable;
};

export async function listMailboxes(
  deps: MailboxServiceDeps,
  ctx: AuthContext,
): Promise<Mailbox[]> {
  const repo = new MailboxRepository(deps.db);
  return repo.listForUser(ctx.userId);
}

export async function getMailbox(
  deps: MailboxServiceDeps,
  ctx: AuthContext,
  mailboxId: string,
): Promise<Mailbox> {
  await requireMailboxAccess(deps.db, ctx, mailboxId);
  const repo = new MailboxRepository(deps.db);
  const mailbox = await repo.findById(mailboxId);
  if (!mailbox) throw new NotFoundError('mailbox not found');
  return mailbox;
}
