import type { D1Queryable } from '../db.js';

export type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_token: string;
  expires_at: string;
  created_at: string;
  last_seen_at: string;
  user_agent: string | null;
  ip_hash: string | null;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  ipHash: string | null;
};

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    userAgent: row.user_agent,
    ipHash: row.ip_hash,
  };
}

export class SessionRepository {
  constructor(private readonly db: D1Queryable) {}

  async create(input: {
    id: string;
    userId: string;
    tokenHash: string;
    csrfToken: string;
    expiresAt: string;
    createdAt: string;
    userAgent?: string | null;
    ipHash?: string | null;
  }): Promise<SessionRecord> {
    await this.db
      .prepare(
        `INSERT INTO sessions (
           id, user_id, token_hash, csrf_token, expires_at, created_at, last_seen_at,
           user_agent, ip_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.userId,
        input.tokenHash,
        input.csrfToken,
        input.expiresAt,
        input.createdAt,
        input.createdAt,
        input.userAgent ?? null,
        input.ipHash ?? null,
      )
      .run();

    return {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      csrfToken: input.csrfToken,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      lastSeenAt: input.createdAt,
      userAgent: input.userAgent ?? null,
      ipHash: input.ipHash ?? null,
    };
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, token_hash, csrf_token, expires_at, created_at, last_seen_at,
                user_agent, ip_hash
         FROM sessions WHERE token_hash = ?`,
      )
      .bind(tokenHash)
      .first<SessionRow>();
    return row ? mapSession(row) : null;
  }

  async touch(sessionId: string, lastSeenAt: string): Promise<void> {
    await this.db
      .prepare(`UPDATE sessions SET last_seen_at = ? WHERE id = ?`)
      .bind(lastSeenAt, sessionId)
      .run();
  }

  async deleteById(sessionId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
  }

  async deleteExpired(nowIso: string): Promise<void> {
    await this.db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(nowIso).run();
  }
}
