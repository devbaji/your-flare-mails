import {
  ThreadRepository,
  type D1Queryable,
} from '@your-flare-mails/cloudflare';
import type { Thread } from '@your-flare-mails/core';

import {
  NotFoundError,
  ValidationError,
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

async function requireThread(
  deps: ThreadServiceDeps,
  ctx: AuthContext,
  threadId: string,
): Promise<Thread> {
  return getThread(deps, ctx, threadId);
}

/** Archive: leave inbox, land in archive. */
export async function archiveThread(
  deps: ThreadServiceDeps,
  ctx: AuthContext,
  threadId: string,
): Promise<Thread> {
  const thread = await requireThread(deps, ctx, threadId);
  const nowIso = new Date().toISOString();
  await new ThreadRepository(deps.db).moveSystemLabels(
    thread.mailboxId,
    thread.id,
    ['inbox'],
    'archive',
    nowIso,
  );
  return getThread(deps, ctx, threadId);
}

/** Trash: remove from inbox/archive, add trash. */
export async function trashThread(
  deps: ThreadServiceDeps,
  ctx: AuthContext,
  threadId: string,
): Promise<Thread> {
  const thread = await requireThread(deps, ctx, threadId);
  const nowIso = new Date().toISOString();
  await new ThreadRepository(deps.db).moveSystemLabels(
    thread.mailboxId,
    thread.id,
    ['inbox', 'archive'],
    'trash',
    nowIso,
  );
  return getThread(deps, ctx, threadId);
}

/** Restore to inbox from archive or trash. */
export async function moveThreadToInbox(
  deps: ThreadServiceDeps,
  ctx: AuthContext,
  threadId: string,
): Promise<Thread> {
  const thread = await requireThread(deps, ctx, threadId);
  const nowIso = new Date().toISOString();
  await new ThreadRepository(deps.db).moveSystemLabels(
    thread.mailboxId,
    thread.id,
    ['archive', 'trash'],
    'inbox',
    nowIso,
  );
  return getThread(deps, ctx, threadId);
}

export type ThreadFolderAction = 'archive' | 'trash' | 'inbox';

export async function applyThreadFolderAction(
  deps: ThreadServiceDeps,
  ctx: AuthContext,
  threadId: string,
  action: ThreadFolderAction,
): Promise<Thread> {
  switch (action) {
    case 'archive':
      return archiveThread(deps, ctx, threadId);
    case 'trash':
      return trashThread(deps, ctx, threadId);
    case 'inbox':
      return moveThreadToInbox(deps, ctx, threadId);
    default:
      throw new ValidationError(`unknown folder action: ${action as string}`);
  }
}
