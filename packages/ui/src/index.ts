export const PACKAGE_NAME = '@your-flare-mails/ui' as const;
export type PackageName = typeof PACKAGE_NAME;

export { sanitizeEmailHtml } from './sanitize.js';
