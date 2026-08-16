import { PACKAGE_NAME as API_CLIENT_PACKAGE_NAME } from '@your-flare-mails/api-client';
import { PACKAGE_NAME as SERVER_PACKAGE_NAME } from '@your-flare-mails/server';

/**
 * Nuxt module entry (Phase 4). Registers composables, routes, and runtime config.
 */
export const PACKAGE_NAME = '@your-flare-mails/nuxt' as const;

export const DEPENDS_ON_SERVER = SERVER_PACKAGE_NAME;
export const DEPENDS_ON_API_CLIENT = API_CLIENT_PACKAGE_NAME;

export type PackageName = typeof PACKAGE_NAME;
