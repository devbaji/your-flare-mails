import {
  INGEST_NONCE_HEADER,
  INGEST_SIGNATURE_HEADER,
  INGEST_TIMESTAMP_HEADER,
} from '@your-flare-mails/core';
import {
  AuthorizationError,
  NotFoundError,
  createAttachmentDownloadUrl,
  getAttachment,
  getMailbox,
  getMessage,
  getThread,
  ingestEmail,
  listMailboxes,
  listThreadMessages,
  listThreads,
  openAttachmentContent,
  type AuthContext,
} from '@your-flare-mails/server';

export interface Env {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  INGEST_HMAC_SECRET: string;
  /** Optional public origin for signed download URLs. Defaults to request origin. */
  PUBLIC_BASE_URL?: string;
}

/** Temporary Phase 3 identity header — replaced by real sessions in Phase 8. */
const DEV_USER_HEADER = 'x-yfm-user-id';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof AuthorizationError) {
    return json({ error: error.code, message: error.message }, 403);
  }
  if (error instanceof NotFoundError) {
    return json({ error: error.code, message: error.message }, 404);
  }
  console.error(error);
  return json({ error: 'internal_error' }, 500);
}

function requireAuth(request: Request): AuthContext | Response {
  const userId = request.headers.get(DEV_USER_HEADER)?.trim();
  if (!userId) {
    return json(
      {
        error: 'unauthorized',
        message: `missing ${DEV_USER_HEADER} (temporary Phase 3 auth; Phase 8 adds sessions)`,
      },
      401,
    );
  }
  return { userId };
}

function match(
  pathname: string,
  pattern: RegExp,
): RegExpMatchArray | null {
  return pathname.match(pattern);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const publicBaseUrl = env.PUBLIC_BASE_URL || url.origin;

    if (request.method === 'GET' && pathname === '/health') {
      return json({ ok: true, service: 'your-flare-mails-api' });
    }

    if (request.method === 'POST' && pathname === '/api/inbound/email') {
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

    // Tokenized attachment download — no session header required.
    const contentMatch = match(pathname, /^\/api\/attachments\/([^/]+)\/content$/);
    if (request.method === 'GET' && contentMatch) {
      const attachmentId = contentMatch[1]!;
      const token = url.searchParams.get('token') ?? '';
      try {
        const file = await openAttachmentContent(
          {
            db: env.DB,
            r2: env.ATTACHMENTS,
            blobSigningSecret: env.INGEST_HMAC_SECRET,
            publicBaseUrl,
          },
          attachmentId,
          token,
        );
        return new Response(file.body, {
          status: 200,
          headers: {
            'content-type': file.contentType,
            'content-length': String(file.size),
            'content-disposition': `attachment; filename="${file.filename.replace(/"/g, '')}"`,
            'cache-control': 'private, max-age=60',
          },
        });
      } catch (error) {
        return errorResponse(error);
      }
    }

    const auth = requireAuth(request);
    if (auth instanceof Response) return auth;
    const ctx = auth;
    const deps = { db: env.DB, r2: env.ATTACHMENTS };

    try {
      if (request.method === 'GET' && pathname === '/api/mailboxes') {
        return json({ mailboxes: await listMailboxes(deps, ctx) });
      }

      const mailboxMatch = match(pathname, /^\/api\/mailboxes\/([^/]+)$/);
      if (request.method === 'GET' && mailboxMatch) {
        return json({ mailbox: await getMailbox(deps, ctx, mailboxMatch[1]!) });
      }

      const threadsMatch = match(pathname, /^\/api\/mailboxes\/([^/]+)\/threads$/);
      if (request.method === 'GET' && threadsMatch) {
        const mailboxId = threadsMatch[1]!;
        const threads = await listThreads(deps, ctx, {
          mailboxId,
          limit: Number(url.searchParams.get('limit') ?? 50),
          before: url.searchParams.get('before'),
          labelSlug: url.searchParams.get('label'),
        });
        return json({ threads });
      }

      const threadMatch = match(pathname, /^\/api\/threads\/([^/]+)$/);
      if (request.method === 'GET' && threadMatch) {
        return json({ thread: await getThread(deps, ctx, threadMatch[1]!) });
      }

      const threadMessagesMatch = match(
        pathname,
        /^\/api\/threads\/([^/]+)\/messages$/,
      );
      if (request.method === 'GET' && threadMessagesMatch) {
        return json({
          messages: await listThreadMessages(deps, ctx, threadMessagesMatch[1]!),
        });
      }

      const messageMatch = match(pathname, /^\/api\/messages\/([^/]+)$/);
      if (request.method === 'GET' && messageMatch) {
        return json(await getMessage(deps, ctx, messageMatch[1]!));
      }

      const attachmentMatch = match(pathname, /^\/api\/attachments\/([^/]+)$/);
      if (request.method === 'GET' && attachmentMatch) {
        return json({
          attachment: await getAttachment(
            {
              db: env.DB,
              r2: env.ATTACHMENTS,
              blobSigningSecret: env.INGEST_HMAC_SECRET,
              publicBaseUrl,
            },
            ctx,
            attachmentMatch[1]!,
          ),
        });
      }

      const attachmentUrlMatch = match(
        pathname,
        /^\/api\/attachments\/([^/]+)\/url$/,
      );
      if (request.method === 'POST' && attachmentUrlMatch) {
        return json(
          await createAttachmentDownloadUrl(
            {
              db: env.DB,
              r2: env.ATTACHMENTS,
              blobSigningSecret: env.INGEST_HMAC_SECRET,
              publicBaseUrl,
            },
            ctx,
            attachmentUrlMatch[1]!,
          ),
        );
      }
    } catch (error) {
      return errorResponse(error);
    }

    return json({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler<Env>;
