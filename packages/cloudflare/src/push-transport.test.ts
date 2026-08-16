import { describe, expect, it } from 'vitest';

import { MockPushTransport } from './push-transport.js';

describe('MockPushTransport', () => {
  it('records sent pushes', async () => {
    const transport = new MockPushTransport();
    const result = await transport.sendToDevice({
      platform: 'ios',
      endpoint: 'abcd1234',
      message: { title: 'New mail', body: 'Hello' },
    });
    expect(result.ok).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.message.title).toBe('New mail');
  });
});
