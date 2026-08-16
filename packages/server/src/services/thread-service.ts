import {
  ThreadRepository,
  type D1Queryable,
} from '@your-flare-mails/cloudflare';
import type { Thread } from '@your-flare-mails/core';

import {
  NotFoundError,
  requireMailboxAccess,
  type AuthContext,
} from '../auth/context.js';

export type ThreadServiceDeps = {
  db: D1Queryable;
};

export async function listThreads(
  deps: ThreadServiceDeps,
  ctx: AuthContext,
  input: {
    mailboxId: string;
    limit?: number;
    before?: string | null;
    labelSlug?: string | null;
  },
): Promise<Thread[]> {
  await requireMailboxAccess(deps.db, ctx, input.mailboxId);
  const repo = new ThreadRepository(deps.db);
  return repo.list(input);
}

export async function getThread(
  deps: ThreadServiceDeps,
  ctx: AuthContext,
  threadId: string,
): Promise<Thread> {
  const repo = new ThreadRepository(deps.db);
  const thread = await repo.findById(threadId);
  if (!thread) throw new NotFoundError('thread not found');
  await requireMailboxAccess(deps.db, ctx, thread.mailboxId);
  return thread;
}
