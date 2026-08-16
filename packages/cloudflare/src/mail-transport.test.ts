import { describe, expect, it, vi } from 'vitest';

import { CloudflareEmailTransport, type CloudflareEmailSendPayload } from './mail-transport.js';

describe('CloudflareEmailTransport', () => {
  it('maps OutboundMail onto the structured send_email payload', async () => {
    const send = vi.fn(async (_message: CloudflareEmailSendPayload) => ({ messageId: 'cf-1' }));
    const transport = new CloudflareEmailTransport({ send });

    const result = await transport.send({
      from: { address: 'hello@example.com', name: 'Hello' },
      to: [{ address: 'alice@example.com' }],
      subject: 'Hi',
      text: 'body',
      messageId: '<out-1@example.com>',
      inReplyTo: '<in-1@example.com>',
      references: '<in-1@example.com>',
    });

    expect(result).toEqual({ ok: true, providerMessageId: 'cf-1' });
    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload!.from).toEqual({ email: 'hello@example.com', name: 'Hello' });
    expect(payload!.to).toEqual(['alice@example.com']);
    expect(payload!.headers?.['Message-ID']).toBe('<out-1@example.com>');
    expect(payload!.headers?.['In-Reply-To']).toBe('<in-1@example.com>');
  });

  it('returns ok:false when the binding throws', async () => {
    const transport = new CloudflareEmailTransport({
      async send() {
        throw new Error('quota exceeded');
      },
    });

    const result = await transport.send({
      from: { address: 'hello@example.com' },
      to: [{ address: 'alice@example.com' }],
      subject: 'Hi',
      text: 'body',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('quota exceeded');
  });
});
