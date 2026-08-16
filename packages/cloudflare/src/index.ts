/**
 * Cloudflare platform adapters for YourFlareMails.
 */

export const PACKAGE_NAME = '@your-flare-mails/cloudflare' as const;
export type PackageName = typeof PACKAGE_NAME;

export * from './db.js';
export * from './mime/parse.js';
export * from './ingest/repository.js';
export * from './ingest/threading.js';
export * from './r2/blobs.js';
export * from './repos/mailboxes.js';
export * from './repos/threads.js';
export * from './repos/messages.js';
export * from './repos/search.js';
export * from './repos/drafts.js';
