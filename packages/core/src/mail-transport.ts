import { z } from 'zod';

import { EmailAddressSchema } from './schemas/primitives.js';

/**
 * Outbound mail transport abstraction.
 * v1 ships CloudflareEmailTransport (packages/cloudflare) + MockMailTransport.
 */

export const OutboundAddressSchema = z.object({
  address: EmailAddressSchema,
  name: z.string().max(200).optional(),
});
export type OutboundAddress = z.infer<typeof OutboundAddressSchema>;

export const OutboundMailSchema = z.object({
  from: OutboundAddressSchema,
  to: z.array(OutboundAddressSchema).min(1),
  cc: z.array(OutboundAddressSchema).optional(),
  bcc: z.array(OutboundAddressSchema).optional(),
  replyTo: OutboundAddressSchema.optional(),
  subject: z.string().max(998),
  text: z.string().optional(),
  html: z.string().optional(),
  /** Optional RFC Message-ID for the outbound message. */
  messageId: z.string().max(998).optional(),
  inReplyTo: z.string().max(998).optional(),
  references: z.string().max(4000).optional(),
});
export type OutboundMail = z.infer<typeof OutboundMailSchema>;

export const SendResultSchema = z.object({
  ok: z.boolean(),
  /** Provider-specific identifier when available. */
  providerMessageId: z.string().optional(),
  error: z.string().optional(),
});
export type SendResult = z.infer<typeof SendResultSchema>;

export interface MailTransport {
  send(message: OutboundMail): Promise<SendResult>;
}

export type MockMailTransportOptions = {
  /** When true, send() returns ok: false with a fixed error. */
  fail?: boolean;
  onSend?: (message: OutboundMail) => void | Promise<void>;
};

/**
 * Dev/test transport that records sends and never talks to the network.
 */
export class MockMailTransport implements MailTransport {
  readonly sent: OutboundMail[] = [];
  private readonly fail: boolean;
  private readonly onSend?: MockMailTransportOptions['onSend'];

  constructor(options: MockMailTransportOptions = {}) {
    this.fail = options.fail ?? false;
    this.onSend = options.onSend;
  }

  async send(message: OutboundMail): Promise<SendResult> {
    const parsed = OutboundMailSchema.parse(message);
    this.sent.push(parsed);
    await this.onSend?.(parsed);

    if (this.fail) {
      return { ok: false, error: 'MockMailTransport: forced failure' };
    }

    return {
      ok: true,
      providerMessageId: `mock-${this.sent.length}`,
    };
  }

  clear(): void {
    this.sent.length = 0;
  }
}
