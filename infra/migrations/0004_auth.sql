-- Phase 8: sessions, password hashes, rate-limit buckets

PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN password_hash TEXT;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT,
  ip_hash TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);
