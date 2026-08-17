import {
  addImportsDir,
  addPlugin,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit';

export type YourFlareMailsModuleOptions = {
  /** Base URL of the mailbox HTTP API (workers/api). */
  apiBaseUrl?: string;
  brandName?: string;
};

declare module '@nuxt/schema' {
  interface NuxtConfig {
    yourFlareMails?: YourFlareMailsModuleOptions;
  }
  interface PublicRuntimeConfig {
    yourFlareMails: {
      apiBaseUrl: string;
      brandName: string;
    };
  }
}

export default defineNuxtModule<YourFlareMailsModuleOptions>({
  meta: {
    name: '@your-flare-mails/nuxt',
    configKey: 'yourFlareMails',
  },
  defaults: {
    apiBaseUrl: 'http://127.0.0.1:8787',
    brandName: 'Devbaji Mails',
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);

    // Prefer explicit env at setup time — nuxt.config may evaluate before .env.production.local loads.
    const apiBaseUrl =
      process.env.NUXT_PUBLIC_API_BASE_URL?.trim() ||
      options.apiBaseUrl ||
      'http://127.0.0.1:8787';
    const brandName =
      process.env.NUXT_PUBLIC_YFM_BRAND_NAME?.trim() ||
      process.env.YFM_BRAND_NAME?.trim() ||
      options.brandName ||
      'Devbaji Mails';

    nuxt.options.runtimeConfig.public.yourFlareMails = {
      apiBaseUrl,
      brandName,
    };

    if (nuxt.options.app?.head && typeof nuxt.options.app.head === 'object') {
      nuxt.options.app.head.title = brandName;
    }

    nuxt.options.build = nuxt.options.build || {};
    nuxt.options.build.transpile = nuxt.options.build.transpile || [];
    for (const pkg of [
      '@your-flare-mails/nuxt',
      '@your-flare-mails/api-client',
      '@your-flare-mails/ui',
      '@your-flare-mails/theme',
    ]) {
      if (!nuxt.options.build.transpile.includes(pkg)) {
        nuxt.options.build.transpile.push(pkg);
      }
    }

    addPlugin(resolver.resolve('./runtime/plugin'));
    addPlugin(resolver.resolve('./runtime/plugins/auth-bootstrap.client'));
    addImportsDir(resolver.resolve('./runtime/composables'));
  },
});
