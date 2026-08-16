-- Production mailbox bootstrap (template).
-- Copy to seed-prod.sql, replace placeholders, then:
--   pnpm db:seed:remote
--
-- Generate password_hash:
--   pnpm --filter @your-flare-mails/infra run hash-password -- 'your-strong-password'
--
-- Do not commit seed-prod.sql (gitignored).

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (id, email, display_name, created_at, updated_at)
VALUES (
  'user_prod_owner',
  '__OWNER_EMAIL__',
  'Mailbox Owner',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

UPDATE users
SET password_hash = '__PASSWORD_HASH__',
    updated_at = '2026-01-01T00:00:00.000Z'
WHERE id = 'user_prod_owner';

INSERT OR IGNORE INTO domains (id, name, zone_id, created_at, updated_at)
VALUES (
  'dom_prod_primary',
  '__MAIL_DOMAIN__',
  NULL,
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO mailboxes (
  id, domain_id, local_part, address, display_name, created_at, updated_at
)
VALUES (
  'mbx_prod_hello',
  'dom_prod_primary',
  '__LOCAL_PART__',
  '__MAILBOX_ADDRESS__',
  'Hello',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO mailbox_users (mailbox_id, user_id, role, created_at)
VALUES (
  'mbx_prod_hello',
  'user_prod_owner',
  'owner',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO labels (id, mailbox_id, slug, name, is_system, color, created_at)
VALUES
  ('lbl_prod_inbox', 'mbx_prod_hello', 'inbox', 'Inbox', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_prod_sent', 'mbx_prod_hello', 'sent', 'Sent', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_prod_drafts', 'mbx_prod_hello', 'drafts', 'Drafts', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_prod_archive', 'mbx_prod_hello', 'archive', 'Archive', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_prod_trash', 'mbx_prod_hello', 'trash', 'Trash', 1, NULL, '2026-01-01T00:00:00.000Z'),
  ('lbl_prod_spam', 'mbx_prod_hello', 'spam', 'Spam', 1, NULL, '2026-01-01T00:00:00.000Z');
