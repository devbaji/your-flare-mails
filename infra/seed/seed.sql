-- Idempotent local seed for YourFlareMails.
-- Fixed IDs + INSERT OR IGNORE so re-running is safe.
-- Addresses use example.com only.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (id, email, display_name, created_at, updated_at)
VALUES (
  'user_seed_owner',
  'owner@example.com',
  'Mailbox Owner',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO domains (id, name, zone_id, created_at, updated_at)
VALUES (
  'dom_seed_example',
  'example.com',
  NULL,
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO mailboxes (
  id, domain_id, local_part, address, display_name, created_at, updated_at
)
VALUES (
  'mbx_seed_hello',
  'dom_seed_example',
  'hello',
  'hello@example.com',
  'Hello',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO mailbox_users (mailbox_id, user_id, role, created_at)
VALUES (
  'mbx_seed_hello',
  'user_seed_owner',
  'owner',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO labels (id, mailbox_id, slug, name, is_system, color, created_at)
VALUES
  ('lbl_seed_inbox', 'mbx_seed_hello', 'inbox', 'Inbox', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_seed_sent', 'mbx_seed_hello', 'sent', 'Sent', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_seed_drafts', 'mbx_seed_hello', 'drafts', 'Drafts', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_seed_archive', 'mbx_seed_hello', 'archive', 'Archive', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_seed_trash', 'mbx_seed_hello', 'trash', 'Trash', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_seed_spam', 'mbx_seed_hello', 'spam', 'Spam', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_seed_work', 'mbx_seed_hello', 'work', 'Work', 0, '#2563eb', '2026-01-01T00:00:00.000Z');

-- Thread 1: welcome / reply
INSERT OR IGNORE INTO threads (
  id, mailbox_id, subject, snippet, last_message_at, message_count, is_unread, created_at, updated_at
)
VALUES (
  'thr_seed_welcome',
  'mbx_seed_hello',
  'Welcome to YourFlareMails',
  'Glad you are trying the local mailbox seed.',
  '2026-01-02T10:05:00.000Z',
  2,
  1,
  '2026-01-02T10:00:00.000Z',
  '2026-01-02T10:05:00.000Z'
);

INSERT OR IGNORE INTO messages (
  id, mailbox_id, thread_id, fingerprint, message_id_header, in_reply_to, references_header,
  direction, status, from_address, from_name, reply_to, subject, date,
  body_text, body_text_r2_key, body_html_r2_key, raw_mime_r2_key, recipients_text,
  has_attachments, size_bytes, created_at, updated_at
)
VALUES (
  'msg_seed_welcome_1',
  'mbx_seed_hello',
  'thr_seed_welcome',
  'fp_seed_welcome_1',
  '<welcome-1@mail.example.com>',
  NULL,
  NULL,
  'inbound',
  'received',
  'noreply@mail.example.com',
  'YourFlareMails',
  NULL,
  'Welcome to YourFlareMails',
  '2026-01-02T10:00:00.000Z',
  'Welcome! This is a plain-text seed message for local development.',
  NULL,
  NULL,
  'seed/raw/welcome-1.eml',
  'hello@example.com',
  0,
  420,
  '2026-01-02T10:00:00.000Z',
  '2026-01-02T10:00:00.000Z'
);

INSERT OR IGNORE INTO messages (
  id, mailbox_id, thread_id, fingerprint, message_id_header, in_reply_to, references_header,
  direction, status, from_address, from_name, reply_to, subject, date,
  body_text, body_text_r2_key, body_html_r2_key, raw_mime_r2_key, recipients_text,
  has_attachments, size_bytes, created_at, updated_at
)
VALUES (
  'msg_seed_welcome_2',
  'mbx_seed_hello',
  'thr_seed_welcome',
  'fp_seed_welcome_2',
  '<welcome-2@mail.example.com>',
  '<welcome-1@mail.example.com>',
  '<welcome-1@mail.example.com>',
  'inbound',
  'received',
  'noreply@mail.example.com',
  'YourFlareMails',
  NULL,
  'Re: Welcome to YourFlareMails',
  '2026-01-02T10:05:00.000Z',
  'Glad you are trying the local mailbox seed.',
  NULL,
  NULL,
  'seed/raw/welcome-2.eml',
  'hello@example.com',
  0,
  380,
  '2026-01-02T10:05:00.000Z',
  '2026-01-02T10:05:00.000Z'
);

INSERT OR IGNORE INTO message_recipients (id, message_id, type, address, name)
VALUES
  ('rcpt_seed_w1', 'msg_seed_welcome_1', 'to', 'hello@example.com', 'Hello'),
  ('rcpt_seed_w2', 'msg_seed_welcome_2', 'to', 'hello@example.com', 'Hello');

INSERT OR IGNORE INTO thread_labels (thread_id, label_id, created_at)
VALUES ('thr_seed_welcome', 'lbl_seed_inbox', '2026-01-02T10:00:00.000Z');

INSERT OR IGNORE INTO message_labels (message_id, label_id, created_at)
VALUES
  ('msg_seed_welcome_1', 'lbl_seed_inbox', '2026-01-02T10:00:00.000Z'),
  ('msg_seed_welcome_2', 'lbl_seed_inbox', '2026-01-02T10:05:00.000Z');

-- Thread 2: HTML + attachment
INSERT OR IGNORE INTO threads (
  id, mailbox_id, subject, snippet, last_message_at, message_count, is_unread, created_at, updated_at
)
VALUES (
  'thr_seed_invoice',
  'mbx_seed_hello',
  'Invoice #1042 attached',
  'Please find the invoice attached.',
  '2026-01-03T15:30:00.000Z',
  1,
  1,
  '2026-01-03T15:30:00.000Z',
  '2026-01-03T15:30:00.000Z'
);

INSERT OR IGNORE INTO messages (
  id, mailbox_id, thread_id, fingerprint, message_id_header, in_reply_to, references_header,
  direction, status, from_address, from_name, reply_to, subject, date,
  body_text, body_text_r2_key, body_html_r2_key, raw_mime_r2_key, recipients_text,
  has_attachments, size_bytes, created_at, updated_at
)
VALUES (
  'msg_seed_invoice_1',
  'mbx_seed_hello',
  'thr_seed_invoice',
  'fp_seed_invoice_1',
  '<invoice-1042@billing.example.com>',
  NULL,
  NULL,
  'inbound',
  'received',
  'billing@example.com',
  'Billing',
  NULL,
  'Invoice #1042 attached',
  '2026-01-03T15:30:00.000Z',
  'Please find the invoice attached.',
  NULL,
  'seed/html/invoice-1042.html',
  'seed/raw/invoice-1042.eml',
  'hello@example.com',
  1,
  2048,
  '2026-01-03T15:30:00.000Z',
  '2026-01-03T15:30:00.000Z'
);

INSERT OR IGNORE INTO message_recipients (id, message_id, type, address, name)
VALUES ('rcpt_seed_inv', 'msg_seed_invoice_1', 'to', 'hello@example.com', NULL);

INSERT OR IGNORE INTO attachments (
  id, message_id, filename, content_type, size_bytes, checksum, r2_key, content_id, is_inline, created_at
)
VALUES (
  'att_seed_invoice_pdf',
  'msg_seed_invoice_1',
  'invoice-1042.pdf',
  'application/pdf',
  1024,
  'sha256:seed_invoice_pdf',
  'seed/attachments/invoice-1042.pdf',
  NULL,
  0,
  '2026-01-03T15:30:00.000Z'
);

INSERT OR IGNORE INTO thread_labels (thread_id, label_id, created_at)
VALUES
  ('thr_seed_invoice', 'lbl_seed_inbox', '2026-01-03T15:30:00.000Z'),
  ('thr_seed_invoice', 'lbl_seed_work', '2026-01-03T15:30:00.000Z');

-- Thread 3: outbound sent
INSERT OR IGNORE INTO threads (
  id, mailbox_id, subject, snippet, last_message_at, message_count, is_unread, created_at, updated_at
)
VALUES (
  'thr_seed_outbound',
  'mbx_seed_hello',
  'Lunch tomorrow?',
  'Are you free for lunch tomorrow at noon?',
  '2026-01-04T09:00:00.000Z',
  1,
  0,
  '2026-01-04T09:00:00.000Z',
  '2026-01-04T09:00:00.000Z'
);

INSERT OR IGNORE INTO messages (
  id, mailbox_id, thread_id, fingerprint, message_id_header, in_reply_to, references_header,
  direction, status, from_address, from_name, reply_to, subject, date,
  body_text, body_text_r2_key, body_html_r2_key, raw_mime_r2_key, recipients_text,
  has_attachments, size_bytes, created_at, updated_at
)
VALUES (
  'msg_seed_outbound_1',
  'mbx_seed_hello',
  'thr_seed_outbound',
  'fp_seed_outbound_1',
  '<outbound-lunch@hello.example.com>',
  NULL,
  NULL,
  'outbound',
  'sent',
  'hello@example.com',
  'Hello',
  NULL,
  'Lunch tomorrow?',
  '2026-01-04T09:00:00.000Z',
  'Are you free for lunch tomorrow at noon?',
  NULL,
  NULL,
  NULL,
  'alice@example.com',
  0,
  256,
  '2026-01-04T09:00:00.000Z',
  '2026-01-04T09:00:00.000Z'
);

INSERT OR IGNORE INTO message_recipients (id, message_id, type, address, name)
VALUES ('rcpt_seed_out', 'msg_seed_outbound_1', 'to', 'alice@example.com', 'Alice');

INSERT OR IGNORE INTO thread_labels (thread_id, label_id, created_at)
VALUES ('thr_seed_outbound', 'lbl_seed_sent', '2026-01-04T09:00:00.000Z');

INSERT OR IGNORE INTO message_labels (message_id, label_id, created_at)
VALUES ('msg_seed_outbound_1', 'lbl_seed_sent', '2026-01-04T09:00:00.000Z');

-- Draft
INSERT OR IGNORE INTO drafts (
  id, mailbox_id, thread_id, to_json, cc_json, bcc_json, subject, body_text, body_html,
  in_reply_to_message_id, created_at, updated_at
)
VALUES (
  'drf_seed_1',
  'mbx_seed_hello',
  NULL,
  '[{"address":"bob@example.com","name":"Bob"}]',
  '[]',
  '[]',
  'Project update',
  'Drafting a quick update…',
  NULL,
  NULL,
  '2026-01-05T12:00:00.000Z',
  '2026-01-05T12:30:00.000Z'
);

-- Contacts
INSERT OR IGNORE INTO contacts (id, mailbox_id, email, name, notes, created_at, updated_at)
VALUES
  (
    'ctc_seed_alice',
    'mbx_seed_hello',
    'alice@example.com',
    'Alice',
    'Friend',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    'ctc_seed_bob',
    'mbx_seed_hello',
    'bob@example.com',
    'Bob',
    NULL,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    'ctc_seed_billing',
    'mbx_seed_hello',
    'billing@example.com',
    'Billing',
    'Work contact',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  );

-- Settings
INSERT OR IGNORE INTO settings (id, scope, scope_id, key, value_json, updated_at)
VALUES
  (
    'set_seed_mailbox_tz',
    'mailbox',
    'mbx_seed_hello',
    'timezone',
    '"UTC"',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    'set_seed_user_theme',
    'user',
    'user_seed_owner',
    'theme',
    '"system"',
    '2026-01-01T00:00:00.000Z'
  );
