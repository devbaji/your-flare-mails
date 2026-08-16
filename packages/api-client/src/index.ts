import { PACKAGE_NAME as TYPES_PACKAGE_NAME } from '@your-flare-mails/types';

/**
 * Typed client for the YourFlareMails HTTP API.
 * Shared by web, desktop, and (future) mobile clients.
 */
export const PACKAGE_NAME = '@your-flare-mails/api-client' as const;

export const DEPENDS_ON_TYPES = TYPES_PACKAGE_NAME;

export type PackageName = typeof PACKAGE_NAME;
