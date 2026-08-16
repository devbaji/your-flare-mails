import {
  BODY_INLINE_MAX_BYTES,
  type NormalizedInboundEmail,
} from '@your-flare-mails/core';

import type { D1Queryable } from '../db.js';

export type { D1Queryable } from '../db.js';

export type MailboxRow = {
  id: string;
  address: string;
};

export type MessageRef = {
  id: string;
  threadId: string;
};

export type CreateMessageInput = {
  mailboxId: string;
  threadId: string;
  email: NormalizedInboundEmail;
  rawMimeR2Key: string;
  bodyText: string | null;
  bodyTextR2Key: string | null;
  bodyHtmlR2Key: string | null;
  attachmentKeys: Array<{
    attachment: NormalizedInboundEmail['attachments'][number];
    r2Key: string;
  }>;
  nowIso: string;
  messageId: string;
  labelInboxId: string | null;
};

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function splitBodyForStorage(text: string | null): {
  bodyText: string | null;
  bodyTextR2KeyNeeded: boolean;
} {
  if (text == null) return { bodyText: null, bodyTextR2KeyNeeded: false };
  if (utf8Bytes(text) > BODY_INLINE_MAX_BYTES) {
    return { bodyText: null, bodyTextR2KeyNeeded: true };
  }
  return { bodyText: text, bodyTextR2KeyNeeded: false };
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function extractMessageIds(header: string | null | undefined): string[] {
  if (!header?.trim()) return [];
  const matches = header.match(/<[^>]+>/g);
  if (matches?.length) {
    return matches.map((m) => m.trim());
  }
  return header
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export class D1IngestRepository {
  constructor(private readonly db: D1Queryable) {}

  async findMailboxByAddress(address: string): Promise<MailboxRow | null> {
    return this.db
      .prepare(`SELECT id, address FROM mailboxes WHERE lower(address) = lower(?)`)
      .bind(address)
      .first<MailboxRow>();
  }

  async findMessageByFingerprint(fingerprint: string): Promise<MessageRef | null> {
    return this.db
      .prepare(`SELECT id, thread_id AS threadId FROM messages WHERE fingerprint = ?`)
      .bind(fingerprint)
      .first<MessageRef>();
  }

  async hasNonce(nonce: string): Promise<boolean> {
    const row = await this.db
      .prepare(`SELECT nonce FROM ingestion_nonces WHERE nonce = ?`)
      .bind(nonce)
      .first<{ nonce: string }>();
    return Boolean(row);
  }

  async findMessageByMessageIdHeader(
    mailboxId: string,
    messageIdHeader: string,
  ): Promise<MessageRef | null> {
    return this.db
      .prepare(
        `SELECT id, thread_id AS threadId FROM messages
         WHERE mailbox_id = ? AND lower(message_id_header) = lower(?)
         LIMIT 1`,
      )
      .bind(mailboxId, messageIdHeader)
      .first<MessageRef>();
  }

  async findInboxLabelId(mailboxId: string): Promise<string | null> {
    const row = await this.db
      .prepare(
        `SELECT id FROM labels WHERE mailbox_id = ? AND slug = 'inbox' LIMIT 1`,
      )
      .bind(mailboxId)
      .first<{ id: string }>();
    return row?.id ?? null;
  }

  async resolveThreadId(
    mailboxId: string,
    email: NormalizedInboundEmail,
  ): Promise<{ threadId: string; created: boolean }> {
    const candidates = [
      ...extractMessageIds(email.inReplyTo),
      ...extractMessageIds(email.referencesHeader).reverse(),
    ];

    for (const candidate of candidates) {
      const existing = await this.findMessageByMessageIdHeader(mailboxId, candidate);
      if (existing) {
        return { threadId: existing.threadId, created: false };
      }
    }

    return { threadId: newId('thr'), created: true };
  }

  async persistInbound(input: CreateMessageInput): Promise<void> {
    const { email } = input;
    const recipientsText = [
      ...email.to.map((r) => r.address),
      ...email.cc.map((r) => r.address),
    ].join(' ');

    const recipientStatements = [
      ...email.to.map((r) =>
        this.db
          .prepare(
            `INSERT INTO message_recipients (id, message_id, type, address, name) VALUES (?, ?, 'to', ?, ?)`,
          )
          .bind(newId('rcpt'), input.messageId, r.address, r.name),
      ),
      ...email.cc.map((r) =>
        this.db
          .prepare(
            `INSERT INTO message_recipients (id, message_id, type, address, name) VALUES (?, ?, 'cc', ?, ?)`,
          )
          .bind(newId('rcpt'), input.messageId, r.address, r.name),
      ),
    ];

    const attachmentStatements = input.attachmentKeys.map(({ attachment, r2Key }) =>
      this.db
        .prepare(
          `INSERT INTO attachments (
            id, message_id, filename, content_type, size_bytes, checksum, r2_key, content_id, is_inline, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId('att'),
          input.messageId,
          attachment.filename,
          attachment.contentType,
          attachment.sizeBytes,
          attachment.checksum,
          r2Key,
          attachment.contentId,
          attachment.isInline ? 1 : 0,
          input.nowIso,
        ),
    );

    const labelStatements = input.labelInboxId
      ? [
          this.db
            .prepare(
              `INSERT OR IGNORE INTO thread_labels (thread_id, label_id, created_at) VALUES (?, ?, ?)`,
            )
            .bind(input.threadId, input.labelInboxId, input.nowIso),
          this.db
            .prepare(
              `INSERT OR IGNORE INTO message_labels (message_id, label_id, created_at) VALUES (?, ?, ?)`,
            )
            .bind(input.messageId, input.labelInboxId, input.nowIso),
        ]
      : [];

    await this.db.batch([
      this.db
        .prepare(
          `INSERT OR IGNORE INTO threads (
            id, mailbox_id, subject, snippet, last_message_at, message_count, is_unread, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)`,
        )
        .bind(
          input.threadId,
          input.mailboxId,
          email.subject,
          (email.text ?? '').slice(0, 500) || null,
          email.date,
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'inbound', 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.messageId,
          input.mailboxId,
          input.threadId,
          email.fingerprint,
          email.messageIdHeader,
          email.inReplyTo,
          email.referencesHeader,
          email.fromAddress,
          email.fromName,
          email.replyTo,
          email.subject,
          email.date,
          input.bodyText,
          input.bodyTextR2Key,
          input.bodyHtmlR2Key,
          input.rawMimeR2Key,
          recipientsText,
          email.attachments.length > 0 ? 1 : 0,
          email.rawSizeBytes,
          input.nowIso,
          input.nowIso,
        ),
      this.db
        .prepare(
          `UPDATE threads SET
            message_count = message_count + 1,
            last_message_at = ?,
            snippet = ?,
            is_unread = 1,
            updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          email.date,
          (email.text ?? '').slice(0, 500) || null,
          input.nowIso,
          input.threadId,
        ),
      ...recipientStatements,
      ...attachmentStatements,
      ...labelStatements,
    ]);
  }

  async recordNonce(nonce: string, fingerprint: string, nowIso: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ingestion_nonces (nonce, fingerprint, created_at) VALUES (?, ?, ?)`,
      )
      .bind(nonce, fingerprint, nowIso)
      .run();
  }
}
