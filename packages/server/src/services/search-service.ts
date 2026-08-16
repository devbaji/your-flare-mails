import type { Message, Thread } from '@your-flare-mails/core';
import { SearchRepository, type D1Queryable } from '@your-flare-mails/cloudflare';

import {
  requireMailboxAccess,
  type AuthContext,
} from '../auth/context.js';

export type SearchServiceDeps = {
  db: D1Queryable;
};

export type SearchMessagesInput = {
  mailboxId: string;
  q?: string | null;
  from?: string | null;
  to?: string | null;
  subject?: string | null;
  after?: string | null;
  before?: string | null;
  unread?: boolean | null;
  hasAttachment?: boolean | null;
  labelSlug?: string | null;
  limit?: number;
};

export type SearchMessagesResult = {
  hits: Array<{
    message: Message;
    thread: Thread;
    rank: number | null;
  }>;
};

export async function searchMessages(
  deps: SearchServiceDeps,
  ctx: AuthContext,
  input: SearchMessagesInput,
): Promise<SearchMessagesResult> {
  await requireMailboxAccess(deps.db, ctx, input.mailboxId);
  const hits = await new SearchRepository(deps.db).search(input);
  return { hits };
}
