/**
 * Nitro-agnostic server services for YourFlareMails.
 */

export const PACKAGE_NAME = '@your-flare-mails/server' as const;
export type PackageName = typeof PACKAGE_NAME;

export * from './ingest/ingest-email.js';
