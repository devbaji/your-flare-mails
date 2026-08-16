/**
 * Nitro-agnostic server services for YourFlareMails.
 */

export const PACKAGE_NAME = '@your-flare-mails/server' as const;
export type PackageName = typeof PACKAGE_NAME;

export * from './auth/context.js';
export * from './auth/http.js';
export * from './ingest/ingest-email.js';
export * from './services/auth-service.js';
export * from './services/mailbox-service.js';
export * from './services/thread-service.js';
export * from './services/message-service.js';
export * from './services/attachment-service.js';
export * from './services/search-service.js';
export * from './services/draft-service.js';
export * from './services/outbound-service.js';
