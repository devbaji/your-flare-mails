/**
 * Core domain package for YourFlareMails.
 * No Cloudflare, Vue, or Nuxt imports.
 */

export const PACKAGE_NAME = '@your-flare-mails/core' as const;
export type PackageName = typeof PACKAGE_NAME;

export * from './constants.js';
export * from './fingerprint.js';
export * from './hmac.js';
export * from './mail-transport.js';
export * from './schemas/index.js';
