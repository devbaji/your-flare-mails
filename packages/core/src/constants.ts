/**
 * Storage and mail processing constants shared across packages.
 */

/**
 * Plain-text (and eventually HTML) bodies larger than this many UTF-8 bytes
 * are stored in R2 with a D1 pointer (`body_text_r2_key` / `body_html_r2_key`).
 * Bodies at or below this threshold may live inline in D1.
 */
export const BODY_INLINE_MAX_BYTES = 8 * 1024;

/** Soft cap for a single inbound message (raw MIME) during ingestion. */
export const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

/** Soft cap for a single attachment. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/** System label slugs seeded for every mailbox. */
export const SYSTEM_LABEL_SLUGS = [
  'inbox',
  'sent',
  'drafts',
  'archive',
  'trash',
  'spam',
] as const;

export const SYSTEM_LABEL_NAMES: Record<(typeof SYSTEM_LABEL_SLUGS)[number], string> = {
  inbox: 'Inbox',
  sent: 'Sent',
  drafts: 'Drafts',
  archive: 'Archive',
  trash: 'Trash',
  spam: 'Spam',
};
