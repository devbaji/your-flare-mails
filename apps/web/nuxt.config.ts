import { fileURLToPath } from 'node:url';

import { defineNuxtConfig } from 'nuxt/config';

const desktop = process.env.YFM_DESKTOP === '1';
const brandName =
  process.env.NUXT_PUBLIC_YFM_BRAND_NAME?.trim() ||
  process.env.YFM_BRAND_NAME?.trim() ||
  'Your Flare Mails';

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: ['@your-flare-mails/nuxt'],
  css: ['@your-flare-mails/theme/tokens.css', '~/assets/app.css'],
  ssr: !desktop,
  yourFlareMails: {
    apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8787',
    brandName,
  },
  nitro: {
    preset: desktop ? 'static' : 'cloudflare_module',
  },
  // Auth uses localStorage; keep these client-only to avoid SSR login flash.
  routeRules: {
    '/': { ssr: false },
    '/login': { ssr: false },
    '/mail/**': { ssr: false },
  },
  alias: {
    '@your-flare-mails/ui/components': fileURLToPath(
      new URL('../../packages/ui/src/components.ts', import.meta.url),
    ),
  },
  vite: {
    optimizeDeps: {
      include: ['@your-flare-mails/api-client'],
    },
    clearScreen: false,
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  app: {
    head: {
      title: brandName,
      meta: [
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        },
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,650&display=swap',
        },
      ],
      htmlAttrs: {
        lang: 'en',
      },
    },
  },
});
