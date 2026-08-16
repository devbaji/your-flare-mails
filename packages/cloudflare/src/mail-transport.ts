import type { MailTransport, OutboundAddress, OutboundMail, SendResult } from '@your-flare-mails/core';
import { OutboundMailSchema } from '@your-flare-mails/core';

/**
 * Minimal surface of Cloudflare Workers `send_email` binding.
 * Structured send() is preferred over legacy EmailMessage MIME.
 * @see https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
 */
export type SendEmailBinding = {
  send(message: CloudflareEmailSendPayload): Promise<CloudflareEmailSendResponse | void>;
};

export type CloudflareEmailAddress =
  | string
  | {
      email: string;
      name?: string;
    };

export type CloudflareEmailSendPayload = {
  to: CloudflareEmailAddress | CloudflareEmailAddress[];
  from: CloudflareEmailAddress;
  subject: string;
  text?: string;
  html?: string;
  cc?: CloudflareEmailAddress | CloudflareEmailAddress[];
  bcc?: CloudflareEmailAddress | CloudflareEmailAddress[];
  replyTo?: CloudflareEmailAddress;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: ArrayBuffer | Uint8Array | string;
    type?: string;
  }>;
};

export type CloudflareEmailSendResponse = {
  messageId?: string;
};

function formatAddress(address: OutboundAddress): CloudflareEmailAddress {
  if (address.name) {
    return { email: address.address, name: address.name };
  }
  return address.address;
}

function formatList(
  list: OutboundAddress[] | undefined,
): CloudflareEmailAddress[] | undefined {
  if (!list?.length) return undefined;
  return list.map(formatAddress);
}

/**
 * Cloudflare Email Service transport via Workers `send_email` binding.
 * Local `wrangler dev` simulates the binding (logs; does not deliver) unless
 * the binding is configured with `remote: true`.
 */
export class CloudflareEmailTransport implements MailTransport {
  constructor(private readonly email: SendEmailBinding) {}

  async send(message: OutboundMail): Promise<SendResult> {
    const parsed = OutboundMailSchema.parse(message);
    // Cloudflare Email Sending generates Message-ID itself and rejects it in
    // headers. Keep local messageId for D1; only forward threading headers.
    // @see https://developers.cloudflare.com/email-service/reference/headers/
    const headers: Record<string, string> = {};
    if (parsed.inReplyTo) headers['In-Reply-To'] = parsed.inReplyTo;
    if (parsed.references) headers.References = parsed.references;

    const payload: CloudflareEmailSendPayload = {
      from: formatAddress(parsed.from),
      to: formatList(parsed.to)!,
      subject: parsed.subject,
    };
    const cc = formatList(parsed.cc);
    if (cc) payload.cc = cc;
    const bcc = formatList(parsed.bcc);
    if (bcc) payload.bcc = bcc;
    if (parsed.replyTo) payload.replyTo = formatAddress(parsed.replyTo);
    if (parsed.text) payload.text = parsed.text;
    if (parsed.html) payload.html = parsed.html;
    if (Object.keys(headers).length) payload.headers = headers;

    try {
      const result = await this.email.send(payload);

      return {
        ok: true,
        providerMessageId:
          result && typeof result === 'object' && 'messageId' in result
            ? result.messageId
            : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'CloudflareEmailTransport send failed',
      };
    }
  }
}
