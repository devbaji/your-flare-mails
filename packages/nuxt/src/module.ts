import {
  addImportsDir,
  addPlugin,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit';

export type YourFlareMailsModuleOptions = {
  /** Base URL of the mailbox HTTP API (workers/api in Phase 4). */
  apiBaseUrl?: string;
  /** Temporary identity until Phase 8 sessions. */
  userId?: string;
  brandName?: string;
};

declare module '@nuxt/schema' {
  interface NuxtConfig {
    yourFlareMails?: YourFlareMailsModuleOptions;
  }
  interface PublicRuntimeConfig {
    yourFlareMails: {
      apiBaseUrl: string;
      userId: string;
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
    userId: 'user_seed_owner',
    brandName: 'YourFlareMails',
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);

    nuxt.options.runtimeConfig.public.yourFlareMails = {
      apiBaseUrl: options.apiBaseUrl ?? 'http://127.0.0.1:8787',
      userId: options.userId ?? 'user_seed_owner',
      brandName: options.brandName ?? 'YourFlareMails',
    };

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
    addImportsDir(resolver.resolve('./runtime/composables'));
  },
});
