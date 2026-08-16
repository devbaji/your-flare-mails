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
export * from './mail-transport.js';
export * from './repos/mailboxes.js';
export * from './repos/threads.js';
export * from './repos/messages.js';
export * from './repos/search.js';
export * from './repos/drafts.js';
export * from './repos/outbound.js';
export * from './repos/users.js';
export * from './repos/sessions.js';
export * from './repos/devices.js';
export * from './rate-limit.js';
export * from './push-transport.js';
export * from './auth/access-jwt.js';
export * from './realtime/events.js';
export * from './realtime/mailbox-realtime.js';
