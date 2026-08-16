import type { Mailbox, MailboxUserRole } from '@your-flare-mails/core';

import type { D1Queryable } from '../db.js';

type MailboxRow = {
  id: string;
  domain_id: string;
  local_part: string;
  address: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

function mapMailbox(row: MailboxRow): Mailbox {
  return {
    id: row.id,
    domainId: row.domain_id,
    localPart: row.local_part,
    address: row.address,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MailboxRepository {
  constructor(private readonly db: D1Queryable) {}

  async listForUser(userId: string): Promise<Mailbox[]> {
    const { results } = await this.db
      .prepare(
        `SELECT m.id, m.domain_id, m.local_part, m.address, m.display_name, m.created_at, m.updated_at
         FROM mailboxes m
         INNER JOIN mailbox_users mu ON mu.mailbox_id = m.id
         WHERE mu.user_id = ?
         ORDER BY m.address ASC`,
      )
      .bind(userId)
      .all<MailboxRow>();
    return results.map(mapMailbox);
  }

  async findById(mailboxId: string): Promise<Mailbox | null> {
    const row = await this.db
      .prepare(
        `SELECT id, domain_id, local_part, address, display_name, created_at, updated_at
         FROM mailboxes WHERE id = ?`,
      )
      .bind(mailboxId)
      .first<MailboxRow>();
    return row ? mapMailbox(row) : null;
  }

  async findByAddress(address: string): Promise<Mailbox | null> {
    const row = await this.db
      .prepare(
        `SELECT id, domain_id, local_part, address, display_name, created_at, updated_at
         FROM mailboxes WHERE lower(address) = lower(?)`,
      )
      .bind(address)
      .first<MailboxRow>();
    return row ? mapMailbox(row) : null;
  }

  async getUserRole(
    mailboxId: string,
    userId: string,
  ): Promise<MailboxUserRole | null> {
    const row = await this.db
      .prepare(
        `SELECT role FROM mailbox_users WHERE mailbox_id = ? AND user_id = ?`,
      )
      .bind(mailboxId, userId)
      .first<{ role: MailboxUserRole }>();
    return row?.role ?? null;
  }
}
