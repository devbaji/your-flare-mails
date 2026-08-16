import type { D1Queryable } from '../db.js';
import { newId } from '../ingest/repository.js';

export type OutboundRecipient = {
  address: string;
  name?: string;
};

export type PersistOutboundInput = {
  mailboxId: string;
  threadId: string;
  messageId: string;
  fingerprint: string;
  messageIdHeader: string;
  inReplyTo: string | null;
  referencesHeader: string | null;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  date: string;
  bodyText: string | null;
  recipientsText: string;
  to: OutboundRecipient[];
  cc: OutboundRecipient[];
  bcc: OutboundRecipient[];
  hasAttachments: boolean;
  rawMimeR2Key: string | null;
  nowIso: string;
  labelSentId: string | null;
  status: 'sending' | 'sent' | 'failed';
};

export class OutboundRepository {
  constructor(private readonly db: D1Queryable) {}

  async findLabelId(mailboxId: string, slug: string): Promise<string | null> {
    const row = await this.db
      .prepare(
        `SELECT id FROM labels WHERE mailbox_id = ? AND slug = ? LIMIT 1`,
      )
      .bind(mailboxId, slug)
      .first<{ id: string }>();
    return row?.id ?? null;
  }

  async persistOutbound(input: PersistOutboundInput): Promise<void> {
    const recipientStatements = [
      ...input.to.map((r) =>
        this.db
          .prepare(
            `INSERT INTO message_recipients (id, message_id, type, address, name) VALUES (?, ?, 'to', ?, ?)`,
          )
          .bind(newId('rcpt'), input.messageId, r.address, r.name ?? null),
      ),
      ...input.cc.map((r) =>
        this.db
          .prepare(
            `INSERT INTO message_recipients (id, message_id, type, address, name) VALUES (?, ?, 'cc', ?, ?)`,
          )
          .bind(newId('rcpt'), input.messageId, r.address, r.name ?? null),
      ),
      ...input.bcc.map((r) =>
        this.db
          .prepare(
            `INSERT INTO message_recipients (id, message_id, type, address, name) VALUES (?, ?, 'bcc', ?, ?)`,
          )
          .bind(newId('rcpt'), input.messageId, r.address, r.name ?? null),
      ),
    ];

    const labelStatements = input.labelSentId
      ? [
          this.db
            .prepare(
              `INSERT OR IGNORE INTO thread_labels (thread_id, label_id, created_at) VALUES (?, ?, ?)`,
            )
            .bind(input.threadId, input.labelSentId, input.nowIso),
          this.db
            .prepare(
              `INSERT OR IGNORE INTO message_labels (message_id, label_id, created_at) VALUES (?, ?, ?)`,
            )
            .bind(input.messageId, input.labelSentId, input.nowIso),
        ]
      : [];

    await this.db.batch([
      this.db
        .prepare(
          `INSERT OR IGNORE INTO threads (
            id, mailbox_id, subject, snippet, last_message_at, message_count, is_unread, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
        )
        .bind(
          input.threadId,
          input.mailboxId,
          input.subject,
          (input.bodyText ?? '').slice(0, 500) || null,
          input.date,
          input.nowIso,
          input.nowIso,
        ),
      this.db
        .prepare(
          `INSERT INTO messages (
            id, mailbox_id, thread_id, fingerprint, message_id_header, in_reply_to, references_header,
            direction, status, from_address, from_name, reply_to, subject, date,
            body_text, body_text_r2_key, body_html_r2_key, raw_mime_r2_key, recipients_text,
            has_attachments, size_bytes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'outbound', ?, ?, ?, NULL, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL, ?, ?)`,
        )
        .bind(
          input.messageId,
          input.mailboxId,
          input.threadId,
          input.fingerprint,
          input.messageIdHeader,
          input.inReplyTo,
          input.referencesHeader,
          input.status,
          input.fromAddress,
          input.fromName,
          input.subject,
          input.date,
          input.bodyText,
          input.rawMimeR2Key,
          input.recipientsText,
          input.hasAttachments ? 1 : 0,
          input.nowIso,
          input.nowIso,
        ),
      this.db
        .prepare(
          `UPDATE threads SET
            message_count = message_count + 1,
            last_message_at = ?,
            snippet = ?,
            updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          input.date,
          (input.bodyText ?? '').slice(0, 500) || null,
          input.nowIso,
          input.threadId,
        ),
      ...recipientStatements,
      ...labelStatements,
    ]);
  }

  async updateMessageStatus(
    messageId: string,
    status: 'sending' | 'sent' | 'failed',
    nowIso: string,
  ): Promise<void> {
    await this.db
      .prepare(`UPDATE messages SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(status, nowIso, messageId)
      .run();
  }

  async attachDraftAttachmentToMessage(input: {
    messageId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    checksum: string;
    r2Key: string;
    nowIso: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO attachments (
          id, message_id, filename, content_type, size_bytes, checksum, r2_key, content_id, is_inline, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)`,
      )
      .bind(
        newId('att'),
        input.messageId,
        input.filename,
        input.contentType,
        input.sizeBytes,
        input.checksum,
        input.r2Key,
        input.nowIso,
      )
      .run();
  }
}
