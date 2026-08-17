import { createMailApiClient, type MailApiClient } from '@your-flare-mails/api-client';
import { defineNuxtPlugin, useRuntimeConfig, useState } from '#app';

export default defineNuxtPlugin({
  name: 'yfm-api',
  setup() {
    const config = useRuntimeConfig();
    const yfm = config.public.yourFlareMails as {
      apiBaseUrl: string;
      brandName: string;
    };

    const sessionToken = useState<string | null>('yfm-session-token', () => null);
    const csrfToken = useState<string | null>('yfm-csrf-token', () => null);

    const api = createMailApiClient({
      baseUrl: yfm.apiBaseUrl,
      getSessionToken: () => sessionToken.value,
      getCsrfToken: () => csrfToken.value,
      credentials: 'include',
    });

    return {
      provide: {
        yfmApi: api as MailApiClient,
        yfmBrandName: yfm.brandName,
      },
    };
  },
});
