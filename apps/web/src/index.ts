import { PACKAGE_NAME as NUXT_PACKAGE_NAME } from '@your-flare-mails/nuxt';
import { PACKAGE_NAME as THEME_PACKAGE_NAME } from '@your-flare-mails/theme';
import { PACKAGE_NAME as UI_PACKAGE_NAME } from '@your-flare-mails/ui';

/**
 * Reference app placeholder. Full Nuxt app lands in Phase 4.
 */
export const APP_NAME = '@your-flare-mails/web' as const;

export const DOGFOODS = {
  nuxt: NUXT_PACKAGE_NAME,
  ui: UI_PACKAGE_NAME,
  theme: THEME_PACKAGE_NAME,
} as const;
