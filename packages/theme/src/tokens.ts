/**
 * Default theme tokens for YourFlareMails.
 * CSS custom properties drive light/dark; JS exports mirror them for tooling.
 */

export const PACKAGE_NAME = '@your-flare-mails/theme' as const;

export const brand = {
  name: 'YourFlareMails',
  tagline: 'Self-hosted mail on Cloudflare',
} as const;

/** Semantic color tokens (CSS variable names without --). */
export const colorTokens = [
  'yfm-bg',
  'yfm-bg-elevated',
  'yfm-bg-muted',
  'yfm-fg',
  'yfm-fg-muted',
  'yfm-border',
  'yfm-accent',
  'yfm-accent-fg',
  'yfm-danger',
  'yfm-focus-ring',
] as const;

export type ColorToken = (typeof colorTokens)[number];

export const typography = {
  display: '"Fraunces", "Iowan Old Style", "Palatino Linotype", serif',
  sans: '"Figtree", "Segoe UI", "Helvetica Neue", sans-serif',
  mono: '"IBM Plex Mono", "SFMono-Regular", ui-monospace, monospace',
} as const;

export const spacing = {
  sidebarWidth: '15rem',
  listWidth: '22rem',
  radius: '0.5rem',
} as const;
