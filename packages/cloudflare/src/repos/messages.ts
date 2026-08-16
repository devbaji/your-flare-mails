import type { Attachment, Message, MessageRecipient } from '@your-flare-mails/core';

import type { D1Queryable } from '../db.js';

type MessageRow = {
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
};

type RecipientRow = {
  id: string;
  message_id: string;
  type: 'to' | 'cc' | 'bcc';
  address: string;
  name: string | null;
};

type AttachmentRow = {
  id: string;
  message_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  checksum: string;
  r2_key: string;
  content_id: string | null;
  is_inline: number;
  created_at: string;
};

export function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    mailboxId: row.mailbox_id,
    threadId: row.thread_id,
    fingerprint: row.fingerprint,
    messageIdHeader: row.message_id_header,
    inReplyTo: row.in_reply_to,
    referencesHeader: row.references_header,
    direction: row.direction,
    status: row.status,
    fromAddress: row.from_address,
    fromName: row.from_name,
    replyTo: row.reply_to,
    subject: row.subject,
    date: row.date,
    bodyText: row.body_text,
    bodyTextR2Key: row.body_text_r2_key,
    bodyHtmlR2Key: row.body_html_r2_key,
    rawMimeR2Key: row.raw_mime_r2_key,
    recipientsText: row.recipients_text,
    hasAttachments: row.has_attachments === 1,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    messageId: row.message_id,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    r2Key: row.r2_key,
    contentId: row.content_id,
    isInline: row.is_inline === 1,
    createdAt: row.created_at,
  };
}

export class MessageRepository {
  constructor(private readonly db: D1Queryable) {}

  async findById(messageId: string): Promise<Message | null> {
    const row = await this.db
      .prepare(`SELECT * FROM messages WHERE id = ?`)
      .bind(messageId)
      .first<MessageRow>();
    return row ? mapMessage(row) : null;
  }

  async listByThread(threadId: string): Promise<Message[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM messages WHERE thread_id = ? ORDER BY date ASC, created_at ASC`,
      )
      .bind(threadId)
      .all<MessageRow>();
    return results.map(mapMessage);
  }

  async listRecipients(messageId: string): Promise<MessageRecipient[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, message_id, type, address, name FROM message_recipients WHERE message_id = ?`,
      )
      .bind(messageId)
      .all<RecipientRow>();
    return results.map((row) => ({
      id: row.id,
      messageId: row.message_id,
      type: row.type,
      address: row.address,
      name: row.name,
    }));
  }
}

export class AttachmentRepository {
  constructor(private readonly db: D1Queryable) {}

  async findById(attachmentId: string): Promise<Attachment | null> {
    const row = await this.db
      .prepare(`SELECT * FROM attachments WHERE id = ?`)
      .bind(attachmentId)
      .first<AttachmentRow>();
    return row ? mapAttachment(row) : null;
  }

  async listByMessage(messageId: string): Promise<Attachment[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM attachments WHERE message_id = ? ORDER BY created_at ASC`,
      )
      .bind(messageId)
      .all<AttachmentRow>();
    return results.map(mapAttachment);
  }
}
