import { createMailApiClient, type MailApiClient } from '@your-flare-mails/api-client';
import { defineNuxtPlugin, useRuntimeConfig, useState } from '#app';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const yfm = config.public.yourFlareMails as {
    apiBaseUrl: string;
    userId: string;
    brandName: string;
  };

  const userId = useState<string>('yfm-user-id', () => yfm.userId);

  const api = createMailApiClient({
    baseUrl: yfm.apiBaseUrl,
    getUserId: () => userId.value,
  });

  return {
    provide: {
      yfmApi: api as MailApiClient,
      yfmBrandName: yfm.brandName,
    },
  };
});
