import type { D1Queryable } from '../db.js';

export type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  passwordHash: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository {
  constructor(private readonly db: D1Queryable) {}

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, email, display_name, password_hash, created_at, updated_at
         FROM users WHERE id = ?`,
      )
      .bind(id)
      .first<UserRow>();
    return row ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, email, display_name, password_hash, created_at, updated_at
         FROM users WHERE lower(email) = lower(?)`,
      )
      .bind(email)
      .first<UserRow>();
    return row ? mapUser(row) : null;
  }

  async setPasswordHash(userId: string, passwordHash: string, nowIso: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(passwordHash, nowIso, userId)
      .run();
  }
}
