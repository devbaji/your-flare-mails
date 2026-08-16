import { describe, expect, it } from 'vitest';

import { BODY_INLINE_MAX_BYTES } from '@your-flare-mails/core';

import { splitBodyForStorage } from './repository.js';

describe('splitBodyForStorage', () => {
  it('keeps small bodies fully inline', () => {
    const result = splitBodyForStorage('hello');
    expect(result.bodyText).toBe('hello');
    expect(result.bodyTextR2KeyNeeded).toBe(false);
  });

  it('keeps a searchable prefix when body exceeds inline max', () => {
    const text = 'x'.repeat(BODY_INLINE_MAX_BYTES + 100);
    const result = splitBodyForStorage(text);
    expect(result.bodyTextR2KeyNeeded).toBe(true);
    expect(result.bodyText).toBeTruthy();
    expect(new TextEncoder().encode(result.bodyText!).byteLength).toBeLessThanOrEqual(
      BODY_INLINE_MAX_BYTES,
    );
  });
});
