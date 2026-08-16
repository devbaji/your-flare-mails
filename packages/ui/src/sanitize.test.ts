import { describe, expect, it } from 'vitest';

import { sanitizeEmailHtml } from './sanitize.js';

describe('sanitizeEmailHtml', () => {
  it('strips script tags and event handlers', () => {
    const input =
      '<div onclick="alert(1)"><script>document.cookie</script><a href="javascript:alert(1)">x</a></div>';
    const out = sanitizeEmailHtml(input);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/javascript:/i);
  });
});
