-- Phase 1 initial schema for YourFlareMails
-- Applied via: pnpm db:migrate (wrangler d1 migrations apply --local)

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE domains (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  zone_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE mailboxes (
  id TEXT PRIMARY KEY NOT NULL,
  domain_id TEXT NOT NULL REFERENCES domains (id),
  local_part TEXT NOT NULL,
  address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (domain_id, local_part)
);

CREATE TABLE mailbox_users (
  mailbox_id TEXT NOT NULL REFERENCES mailboxes (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (mailbox_id, user_id)
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY NOT NULL,
  mailbox_id TEXT NOT NULL REFERENCES mailboxes (id) ON DELETE CASCADE,
  subject TEXT,
  snippet TEXT,
  last_message_at TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  is_unread INTEGER NOT NULL DEFAULT 0 CHECK (is_unread IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_threads_mailbox_last_message
  ON threads (mailbox_id, last_message_at DESC);

CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  mailbox_id TEXT NOT NULL REFERENCES mailboxes (id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads (id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL UNIQUE,
  message_id_header TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL CHECK (
    status IN ('received', 'sending', 'sent', 'failed', 'draft')
  ),
  from_address TEXT NOT NULL,
  from_name TEXT,
  reply_to TEXT,
  subject TEXT,
  date TEXT NOT NULL,
  body_text TEXT,
  body_text_r2_key TEXT,
  body_html_r2_key TEXT,
  raw_mime_r2_key TEXT,
  recipients_text TEXT NOT NULL DEFAULT '',
  has_attachments INTEGER NOT NULL DEFAULT 0 CHECK (has_attachments IN (0, 1)),
  size_bytes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_messages_thread_id ON messages (thread_id);
CREATE INDEX idx_messages_mailbox_date ON messages (mailbox_id, date DESC);
CREATE INDEX idx_messages_message_id_header ON messages (message_id_header);

CREATE TABLE message_recipients (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('to', 'cc', 'bcc')),
  address TEXT NOT NULL,
  name TEXT
);

CREATE INDEX idx_message_recipients_message_id ON message_recipients (message_id);
CREATE INDEX idx_message_recipients_address ON message_recipients (address);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  content_id TEXT,
  is_inline INTEGER NOT NULL DEFAULT 0 CHECK (is_inline IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_attachments_message_id ON attachments (message_id);

CREATE TABLE labels (
  id TEXT PRIMARY KEY NOT NULL,
  mailbox_id TEXT NOT NULL REFERENCES mailboxes (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  color TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (mailbox_id, slug)
);

CREATE TABLE thread_labels (
  thread_id TEXT NOT NULL REFERENCES threads (id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (thread_id, label_id)
);

CREATE TABLE message_labels (
  message_id TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (message_id, label_id)
);

CREATE TABLE drafts (
  id TEXT PRIMARY KEY NOT NULL,
  mailbox_id TEXT NOT NULL REFERENCES mailboxes (id) ON DELETE CASCADE,
  thread_id TEXT REFERENCES threads (id) ON DELETE SET NULL,
  to_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  bcc_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  in_reply_to_message_id TEXT REFERENCES messages (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_drafts_mailbox_id ON drafts (mailbox_id);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY NOT NULL,
  mailbox_id TEXT NOT NULL REFERENCES mailboxes (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (mailbox_id, email)
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'desktop', 'ios', 'android')),
  push_endpoint TEXT,
  push_keys_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_devices_user_id ON devices (user_id);

CREATE TABLE notification_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  mailbox_id TEXT NOT NULL REFERENCES mailboxes (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (device_id, mailbox_id)
);

CREATE TABLE settings (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('user', 'mailbox')),
  scope_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (scope, scope_id, key)
);

-- FTS5 search index (BM25 via MATCH). External-content table synced by triggers.
-- Column names must match `messages` for content='messages'.
CREATE VIRTUAL TABLE messages_fts USING fts5 (
  subject,
  body_text,
  from_address,
  recipients_text,
  content = 'messages',
  content_rowid = 'rowid',
  tokenize = 'porter unicode61'
);

CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts (rowid, subject, body_text, from_address, recipients_text)
  VALUES (
    new.rowid,
    coalesce(new.subject, ''),
    coalesce(new.body_text, ''),
    new.from_address,
    coalesce(new.recipients_text, '')
  );
END;

CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts (
    messages_fts,
    rowid,
    subject,
    body_text,
    from_address,
    recipients_text
  )
  VALUES (
    'delete',
    old.rowid,
    coalesce(old.subject, ''),
    coalesce(old.body_text, ''),
    old.from_address,
    coalesce(old.recipients_text, '')
  );
END;

CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts (
    messages_fts,
    rowid,
    subject,
    body_text,
    from_address,
    recipients_text
  )
  VALUES (
    'delete',
    old.rowid,
    coalesce(old.subject, ''),
    coalesce(old.body_text, ''),
    old.from_address,
    coalesce(old.recipients_text, '')
  );
  INSERT INTO messages_fts (rowid, subject, body_text, from_address, recipients_text)
  VALUES (
    new.rowid,
    coalesce(new.subject, ''),
    coalesce(new.body_text, ''),
    new.from_address,
    coalesce(new.recipients_text, '')
  );
END;
