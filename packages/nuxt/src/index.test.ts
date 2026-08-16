import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME } from './index.js';

describe('@your-flare-mails/nuxt', () => {
  it('exports a stable package name', () => {
    expect(PACKAGE_NAME).toBe('@your-flare-mails/nuxt');
  });
});
