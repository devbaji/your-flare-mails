/**
 * Cloudflare platform adapters for YourFlareMails.
 */

export const PACKAGE_NAME = '@your-flare-mails/cloudflare' as const;
export type PackageName = typeof PACKAGE_NAME;

export * from './mime/parse.js';
export * from './ingest/repository.js';
