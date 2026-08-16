import type { Message, Thread } from '@your-flare-mails/core';

import type { D1Queryable } from '../db.js';
import { buildFtsMatchQuery } from '../ingest/threading.js';
import { mapMessage } from './messages.js';
import { mapThread } from './threads.js';

export type SearchQuery = {
  mailboxId: string;
  /** Free-text FTS query (subject/body/from/recipients). */
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

export type SearchHit = {
  message: Message;
  thread: Thread;
  rank: number | null;
};

type SearchRow = {
  // message columns (aliased)
  id: string;
  mailbox_id: string;
  thread_id: string;
  fingerprint: string;
  message_id_header: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  direction: 'inbound' | 'outbound';
  status: 'received' | 'sending' | 'sent' | 'failed' | 'draft';
  from_address: string;
  from_name: string | null;
  reply_to: string | null;
  subject: string | null;
  date: string;
  body_text: string | null;
  body_text_r2_key: string | null;
  body_html_r2_key: string | null;
  raw_mime_r2_key: string | null;
  recipients_text: string;
  has_attachments: number;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  // thread
  t_id: string;
  t_mailbox_id: string;
  t_subject: string | null;
  t_snippet: string | null;
  t_last_message_at: string | null;
  t_message_count: number;
  t_is_unread: number;
  t_created_at: string;
  t_updated_at: string;
  rank: number | null;
};

export class SearchRepository {
  constructor(private readonly db: D1Queryable) {}

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const fts = query.q?.trim() ? buildFtsMatchQuery(query.q) : null;

    const where: string[] = ['m.mailbox_id = ?'];
    const binds: unknown[] = [query.mailboxId];

    if (fts) {
      where.push('messages_fts MATCH ?');
      binds.push(fts);
    }
    if (query.from?.trim()) {
      where.push('lower(m.from_address) LIKE ?');
      binds.push(`%${query.from.trim().toLowerCase()}%`);
    }
    if (query.to?.trim()) {
      where.push('lower(m.recipients_text) LIKE ?');
      binds.push(`%${query.to.trim().toLowerCase()}%`);
    }
    if (query.subject?.trim()) {
      where.push('lower(m.subject) LIKE ?');
      binds.push(`%${query.subject.trim().toLowerCase()}%`);
    }
    if (query.after?.trim()) {
      where.push('m.date >= ?');
      binds.push(query.after.trim());
    }
    if (query.before?.trim()) {
      where.push('m.date <= ?');
      binds.push(query.before.trim());
    }
    if (query.hasAttachment === true) {
      where.push('m.has_attachments = 1');
    } else if (query.hasAttachment === false) {
      where.push('m.has_attachments = 0');
    }
    if (query.unread === true) {
      where.push('t.is_unread = 1');
    } else if (query.unread === false) {
      where.push('t.is_unread = 0');
    }
    if (query.labelSlug?.trim()) {
      where.push(`EXISTS (
        SELECT 1 FROM message_labels ml
        JOIN labels l ON l.id = ml.label_id
        WHERE ml.message_id = m.id AND l.slug = ?
      )`);
      binds.push(query.labelSlug.trim().toLowerCase());
    }

    const fromClause = fts
      ? `messages_fts
         JOIN messages m ON m.rowid = messages_fts.rowid
         JOIN threads t ON t.id = m.thread_id`
      : `messages m
         JOIN threads t ON t.id = m.thread_id`;

    const orderBy = fts
      ? 'bm25(messages_fts) ASC, m.date DESC'
      : 'm.date DESC';

    const rankSelect = fts ? 'bm25(messages_fts) AS rank' : 'NULL AS rank';

    const sql = `
      SELECT
        m.id, m.mailbox_id, m.thread_id, m.fingerprint, m.message_id_header,
        m.in_reply_to, m.references_header, m.direction, m.status,
        m.from_address, m.from_name, m.reply_to, m.subject, m.date,
        m.body_text, m.body_text_r2_key, m.body_html_r2_key, m.raw_mime_r2_key,
        m.recipients_text, m.has_attachments, m.size_bytes, m.created_at, m.updated_at,
        t.id AS t_id, t.mailbox_id AS t_mailbox_id, t.subject AS t_subject,
        t.snippet AS t_snippet, t.last_message_at AS t_last_message_at,
        t.message_count AS t_message_count, t.is_unread AS t_is_unread,
        t.created_at AS t_created_at, t.updated_at AS t_updated_at,
        ${rankSelect}
      FROM ${fromClause}
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ?
    `;

    binds.push(limit);
    const result = await this.db.prepare(sql).bind(...binds).all<SearchRow>();

    return result.results.map((row) => ({
      message: mapMessage(row),
      thread: mapThread({
        id: row.t_id,
        mailbox_id: row.t_mailbox_id,
        subject: row.t_subject,
        snippet: row.t_snippet,
        last_message_at: row.t_last_message_at,
        message_count: row.t_message_count,
        is_unread: row.t_is_unread,
        created_at: row.t_created_at,
        updated_at: row.t_updated_at,
      }),
      rank: row.rank,
    }));
  }
}
