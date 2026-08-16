import type { Thread } from '@your-flare-mails/core';

import type { D1Queryable } from '../db.js';

type ThreadRow = {
  id: string;
  mailbox_id: string;
  subject: string | null;
  snippet: string | null;
  last_message_at: string | null;
  message_count: number;
  is_unread: number;
  created_at: string;
  updated_at: string;
};

function mapThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    mailboxId: row.mailbox_id,
    subject: row.subject,
    snippet: row.snippet,
    lastMessageAt: row.last_message_at,
    messageCount: row.message_count,
    isUnread: row.is_unread === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ListThreadsOptions = {
  mailboxId: string;
  limit?: number;
  /** ISO date cursor: return threads with last_message_at strictly before this. */
  before?: string | null;
  labelSlug?: string | null;
};

export class ThreadRepository {
  constructor(private readonly db: D1Queryable) {}

  async findById(threadId: string): Promise<Thread | null> {
    const row = await this.db
      .prepare(
        `SELECT id, mailbox_id, subject, snippet, last_message_at, message_count, is_unread, created_at, updated_at
         FROM threads WHERE id = ?`,
      )
      .bind(threadId)
      .first<ThreadRow>();
    return row ? mapThread(row) : null;
  }

  async list(options: ListThreadsOptions): Promise<Thread[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const before = options.before ?? null;
    const labelSlug = options.labelSlug ?? null;

    if (labelSlug) {
      const { results } = await this.db
        .prepare(
          `SELECT t.id, t.mailbox_id, t.subject, t.snippet, t.last_message_at, t.message_count,
                  t.is_unread, t.created_at, t.updated_at
           FROM threads t
           INNER JOIN thread_labels tl ON tl.thread_id = t.id
           INNER JOIN labels l ON l.id = tl.label_id
           WHERE t.mailbox_id = ?
             AND l.slug = ?
             AND (? IS NULL OR t.last_message_at < ?)
           ORDER BY t.last_message_at DESC
           LIMIT ?`,
        )
        .bind(options.mailboxId, labelSlug, before, before, limit)
        .all<ThreadRow>();
      return results.map(mapThread);
    }

    const { results } = await this.db
      .prepare(
        `SELECT id, mailbox_id, subject, snippet, last_message_at, message_count, is_unread, created_at, updated_at
         FROM threads
         WHERE mailbox_id = ?
           AND (? IS NULL OR last_message_at < ?)
         ORDER BY last_message_at DESC
         LIMIT ?`,
      )
      .bind(options.mailboxId, before, before, limit)
      .all<ThreadRow>();
    return results.map(mapThread);
  }
}
