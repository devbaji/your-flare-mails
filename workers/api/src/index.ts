import {
  INGEST_NONCE_HEADER,
  INGEST_SIGNATURE_HEADER,
  INGEST_TIMESTAMP_HEADER,
} from '@your-flare-mails/core';
import { ingestEmail } from '@your-flare-mails/server';

export interface Env {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  INGEST_HMAC_SECRET: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'your-flare-mails-api' });
    }

    if (request.method === 'POST' && url.pathname === '/api/inbound/email') {
      const rawBody = await request.text();
      const signatureHex = request.headers.get(INGEST_SIGNATURE_HEADER) ?? '';
      const timestampHeader = request.headers.get(INGEST_TIMESTAMP_HEADER) ?? '';
      const nonce = request.headers.get(INGEST_NONCE_HEADER) ?? '';
      const timestampSeconds = Number.parseInt(timestampHeader, 10);

      if (!env.INGEST_HMAC_SECRET) {
        return json({ error: 'server_misconfigured' }, 500);
      }

      const result = await ingestEmail(
        {
          db: env.DB,
          r2: env.ATTACHMENTS,
          hmacSecret: env.INGEST_HMAC_SECRET,
        },
        {
          rawBody,
          signatureHex,
          timestampSeconds,
          nonce,
        },
      );

      if (result.status === 'rejected') {
        return json(
          { error: result.code, message: result.message },
          result.httpStatus,
        );
      }

      return json(
        {
          status: result.status,
          messageId: result.messageId,
          threadId: result.threadId,
          mailboxId: result.mailboxId,
        },
        result.status === 'created' ? 201 : 200,
      );
    }

    return json({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler<Env>;
