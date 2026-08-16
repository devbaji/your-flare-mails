import { PACKAGE_NAME as CORE_PACKAGE_NAME } from '@your-flare-mails/core';
import { PACKAGE_NAME as SERVER_PACKAGE_NAME } from '@your-flare-mails/server';

/**
 * Minimal composition example using public package APIs only
 * (no default theme). Verified end-to-end in Phase 12.
 */
export const EXAMPLE_NAME = '@your-flare-mails/example-default-mail' as const;

export const USES = {
  core: CORE_PACKAGE_NAME,
  server: SERVER_PACKAGE_NAME,
} as const;
