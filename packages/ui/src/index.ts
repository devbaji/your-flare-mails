/**
 * Theme-agnostic Vue UI primitives (MailLayout, MessageList, Composer, …).
 * Components land in Phase 4. Must not import packages/core internals.
 */
export const PACKAGE_NAME = '@your-flare-mails/ui' as const;

export type PackageName = typeof PACKAGE_NAME;
