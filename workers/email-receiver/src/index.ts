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
  /**
   * When "true", best-effort forward to verified Email Routing destinations
   * listed in FORWARD_BACKUP_ADDRESSES (comma-separated).
   * Forwards never block or undo successful ingest.
   */
  FORWARD_BACKUP_ENABLED?: string;
  /** Comma-separated verified destination addresses (Email Routing). */
  FORWARD_BACKUP_ADDRESSES?: string;
  /** @deprecated Prefer FORWARD_BACKUP_ADDRESSES. Single address still supported. */
  FORWARD_BACKUP_ADDRESS?: string;
}

type ForwardableEmailMessage = {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream;
  rawSize: number;
  setReject(reason: string): void;
  /** Forward to a destination verified in Email Routing. Must run before reading `.raw`. */
  forward(rcptTo: string, headers?: Headers): Promise<void>;
};

function parseBackupAddresses(env: Env): string[] {
  const raw = env.FORWARD_BACKUP_ADDRESSES || env.FORWARD_BACKUP_ADDRESS || '';
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes('@')),
    ),
  ];
}

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

/**
 * Best-effort forwards to verified destinations.
 * Must be called before reading `message.raw` (Email Routing limitation).
 * Individual failures are logged and never thrown.
 */
async function forwardBackups(message: ForwardableEmailMessage, env: Env): Promise<void> {
  if (env.FORWARD_BACKUP_ENABLED !== 'true') return;
  const addresses = parseBackupAddresses(env);
  if (!addresses.length) {
    console.warn('FORWARD_BACKUP_ENABLED but no FORWARD_BACKUP_ADDRESSES configured');
    return;
  }

  for (const address of addresses) {
    try {
      await message.forward(address);
    } catch (error) {
      console.error('backup forward failed', address, error);
    }
  }
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
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

      // 1) Optional Gmail/etc backup first (must precede reading .raw).
      //    Failures must not skip ingest — the app mailbox is authoritative.
      await forwardBackups(message, env);

      // 2) Parse + ingest into YourFlareMails (D1/R2) — always attempted after backups.
      const parsed = await parseMimeToNormalizedEmail({
        raw: message.raw,
        envelopeFrom: message.from,
        envelopeTo: message.to,
        rawSizeBytes: message.rawSize,
      });

      if (!parsed.ok) {
        console.error('MIME parse failed:', parsed.error);
        message.setReject(
          parsed.reject ? parsed.error : 'Unable to process message',
        );
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
