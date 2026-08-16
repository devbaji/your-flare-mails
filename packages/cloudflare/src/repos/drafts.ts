import { MAX_ATTACHMENT_BYTES } from '@your-flare-mails/core';

import type { D1Queryable } from '../db.js';
import { newId } from '../ingest/repository.js';

export type DraftRow = {
  id: string;
  mailboxId: string;
  threadId: string | null;
  toJson: string;
  ccJson: string;
  bccJson: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  inReplyToMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DraftAttachmentRow = {
  id: string;
  draftId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  checksum: string;
  r2Key: string;
  createdAt: string;
};

type DraftSqlRow = {
  id: string;
  mailbox_id: string;
  thread_id: string | null;
  to_json: string;
  cc_json: string;
  bcc_json: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  in_reply_to_message_id: string | null;
  created_at: string;
  updated_at: string;
};

type DraftAttachmentSqlRow = {
  id: string;
  draft_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  checksum: string;
  r2_key: string;
  created_at: string;
};

function mapDraft(row: DraftSqlRow): DraftRow {
  return {
    id: row.id,
    mailboxId: row.mailbox_id,
    threadId: row.thread_id,
    toJson: row.to_json,
    ccJson: row.cc_json,
    bccJson: row.bcc_json,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    inReplyToMessageId: row.in_reply_to_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDraftAttachment(row: DraftAttachmentSqlRow): DraftAttachmentRow {
  return {
    id: row.id,
    draftId: row.draft_id,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    r2Key: row.r2_key,
    createdAt: row.created_at,
  };
}

export class DraftRepository {
  constructor(private readonly db: D1Queryable) {}

  async findById(draftId: string): Promise<DraftRow | null> {
    const row = await this.db
      .prepare(`SELECT * FROM drafts WHERE id = ?`)
      .bind(draftId)
      .first<DraftSqlRow>();
    return row ? mapDraft(row) : null;
  }

  async listByMailbox(mailboxId: string): Promise<DraftRow[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM drafts WHERE mailbox_id = ? ORDER BY updated_at DESC`,
      )
      .bind(mailboxId)
      .all<DraftSqlRow>();
    return results.map(mapDraft);
  }

  async create(input: {
    id?: string;
    mailboxId: string;
    threadId?: string | null;
    toJson?: string;
    ccJson?: string;
    bccJson?: string;
    subject?: string | null;
    bodyText?: string | null;
    bodyHtml?: string | null;
    inReplyToMessageId?: string | null;
    nowIso: string;
  }): Promise<DraftRow> {
    const id = input.id ?? newId('drf');
    await this.db
      .prepare(
        `INSERT INTO drafts (
          id, mailbox_id, thread_id, to_json, cc_json, bcc_json, subject, body_text, body_html,
          in_reply_to_message_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.mailboxId,
        input.threadId ?? null,
        input.toJson ?? '[]',
        input.ccJson ?? '[]',
        input.bccJson ?? '[]',
        input.subject ?? null,
        input.bodyText ?? null,
        input.bodyHtml ?? null,
        input.inReplyToMessageId ?? null,
        input.nowIso,
        input.nowIso,
      )
      .run();
    const created = await this.findById(id);
    if (!created) throw new Error('draft create failed');
    return created;
  }

  async update(
    draftId: string,
    patch: {
      threadId?: string | null;
      toJson?: string;
      ccJson?: string;
      bccJson?: string;
      subject?: string | null;
      bodyText?: string | null;
      bodyHtml?: string | null;
      inReplyToMessageId?: string | null;
      nowIso: string;
    },
  ): Promise<DraftRow | null> {
    const existing = await this.findById(draftId);
    if (!existing) return null;
    await this.db
      .prepare(
        `UPDATE drafts SET
          thread_id = ?,
          to_json = ?,
          cc_json = ?,
          bcc_json = ?,
          subject = ?,
          body_text = ?,
          body_html = ?,
          in_reply_to_message_id = ?,
          updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        patch.threadId !== undefined ? patch.threadId : existing.threadId,
        patch.toJson ?? existing.toJson,
        patch.ccJson ?? existing.ccJson,
        patch.bccJson ?? existing.bccJson,
        patch.subject !== undefined ? patch.subject : existing.subject,
        patch.bodyText !== undefined ? patch.bodyText : existing.bodyText,
        patch.bodyHtml !== undefined ? patch.bodyHtml : existing.bodyHtml,
        patch.inReplyToMessageId !== undefined
          ? patch.inReplyToMessageId
          : existing.inReplyToMessageId,
        patch.nowIso,
        draftId,
      )
      .run();
    return this.findById(draftId);
  }

  async delete(draftId: string): Promise<boolean> {
    const existing = await this.findById(draftId);
    if (!existing) return false;
    await this.db.prepare(`DELETE FROM drafts WHERE id = ?`).bind(draftId).run();
    return true;
  }
}

export class DraftAttachmentRepository {
  constructor(private readonly db: D1Queryable) {}

  async findById(id: string): Promise<DraftAttachmentRow | null> {
    const row = await this.db
      .prepare(`SELECT * FROM draft_attachments WHERE id = ?`)
      .bind(id)
      .first<DraftAttachmentSqlRow>();
    return row ? mapDraftAttachment(row) : null;
  }

  async listByDraft(draftId: string): Promise<DraftAttachmentRow[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM draft_attachments WHERE draft_id = ? ORDER BY created_at ASC`,
      )
      .bind(draftId)
      .all<DraftAttachmentSqlRow>();
    return results.map(mapDraftAttachment);
  }

  async insert(input: {
    id?: string;
    draftId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    checksum: string;
    r2Key: string;
    nowIso: string;
  }): Promise<DraftAttachmentRow> {
    if (input.sizeBytes > MAX_ATTACHMENT_BYTES) {
      throw new Error(`attachment exceeds MAX_ATTACHMENT_BYTES (${MAX_ATTACHMENT_BYTES})`);
    }
    const id = input.id ?? newId('datt');
    await this.db
      .prepare(
        `INSERT INTO draft_attachments (
          id, draft_id, filename, content_type, size_bytes, checksum, r2_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.draftId,
        input.filename,
        input.contentType,
        input.sizeBytes,
        input.checksum,
        input.r2Key,
        input.nowIso,
      )
      .run();
    return {
      id,
      draftId: input.draftId,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
      r2Key: input.r2Key,
      createdAt: input.nowIso,
    };
  }
}
