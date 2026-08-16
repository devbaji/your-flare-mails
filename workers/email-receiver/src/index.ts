import {
  INGEST_NONCE_HEADER,
  INGEST_SIGNATURE_HEADER,
  INGEST_TIMESTAMP_HEADER,
  MAX_MESSAGE_BYTES,
  signIngestBody,
  type IngestRequest,
} from '@your-flare-mails/core';
import { parseMimeToNormalizedEmail } from '@your-flare-mails/cloudflare';

export interface Env {
  INGEST_URL: string;
  INGEST_HMAC_SECRET: string;
  /** When "true", forward a copy via send_email (migration backup). Default off. */
  FORWARD_BACKUP_ENABLED?: string;
  FORWARD_BACKUP_ADDRESS?: string;
  EMAIL?: {
    send(message: {
      to: string;
      from: string;
      subject: string;
      raw?: ArrayBuffer | string;
    }): Promise<unknown>;
  };
}

type ForwardableEmailMessage = {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream;
  rawSize: number;
  setReject(reason: string): void;
};

async function postIngest(env: Env, request: IngestRequest): Promise<Response> {
  const body = JSON.stringify(request);
  const signature = await signIngestBody({
    secret: env.INGEST_HMAC_SECRET,
    body,
  });

  return fetch(new URL('/api/inbound/email', env.INGEST_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [INGEST_SIGNATURE_HEADER]: signature,
      [INGEST_TIMESTAMP_HEADER]: String(request.timestamp),
      [INGEST_NONCE_HEADER]: request.nonce,
    },
    body,
  });
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      if (!env.INGEST_HMAC_SECRET || !env.INGEST_URL) {
        console.error('email-receiver misconfigured: missing INGEST_URL or INGEST_HMAC_SECRET');
        message.setReject('Mailbox temporarily unavailable');
        return;
      }

      if (message.rawSize > MAX_MESSAGE_BYTES) {
        message.setReject('Message too large');
        return;
      }

      const parsed = await parseMimeToNormalizedEmail({
        raw: message.raw,
        envelopeFrom: message.from,
        envelopeTo: message.to,
        rawSizeBytes: message.rawSize,
      });

      if (!parsed.ok) {
        console.error('MIME parse failed:', parsed.error);
        if (parsed.reject) {
          message.setReject(parsed.error);
        } else {
          // Soft-fail malformed MIME so routing does not bounce aggressively in MVP.
          message.setReject('Unable to process message');
        }
        return;
      }

      const ingestRequest: IngestRequest = {
        timestamp: Math.floor(Date.now() / 1000),
        nonce: crypto.randomUUID(),
        email: parsed.email,
      };

      const response = await postIngest(env, ingestRequest);
      if (!response.ok) {
        const text = await response.text();
        console.error('ingest failed', response.status, text);
        message.setReject('Mailbox temporarily unavailable');
        return;
      }

      if (
        env.FORWARD_BACKUP_ENABLED === 'true' &&
        env.FORWARD_BACKUP_ADDRESS &&
        env.EMAIL
      ) {
        const backupAddress = env.FORWARD_BACKUP_ADDRESS;
        ctx.waitUntil(
          (async () => {
            try {
              await env.EMAIL!.send({
                to: backupAddress,
                from: message.to,
                subject: parsed.email.subject ?? '(no subject)',
                raw: parsed.email.rawMimeBase64,
              });
            } catch (error) {
              console.error('backup forward failed', error);
            }
          })(),
        );
      }
    } catch (error) {
      console.error('email handler error', error);
      try {
        message.setReject('Mailbox temporarily unavailable');
      } catch {
        // ignore
      }
    }
  },
};
