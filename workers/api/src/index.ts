import {
  INGEST_NONCE_HEADER,
  INGEST_SIGNATURE_HEADER,
  INGEST_TIMESTAMP_HEADER,
  MockMailTransport,
} from '@your-flare-mails/core';
import {
  CloudflareEmailTransport,
  type SendEmailBinding,
} from '@your-flare-mails/cloudflare';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  createAttachmentDownloadUrl,
  createDraft,
  createDraftAttachmentDownloadUrl,
  createForwardDraft,
  createReplyDraft,
  deleteDraft,
  getAttachment,
  getDraft,
  getMailbox,
  getMessage,
  getThread,
  ingestEmail,
  listDraftAttachments,
  listDrafts,
  listMailboxes,
  listThreadMessages,
  listThreads,
  openAttachmentContent,
  openDraftAttachmentContent,
  searchMessages,
  sendDraft,
  updateDraft,
  uploadDraftAttachment,
  type AuthContext,
} from '@your-flare-mails/server';

export interface Env {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  INGEST_HMAC_SECRET: string;
  /** Optional public origin for signed download URLs. Defaults to request origin. */
  PUBLIC_BASE_URL?: string;
  /** Cloudflare Email Service send_email binding (simulated locally by Wrangler). */
  EMAIL?: SendEmailBinding;
  /** When "true", force MockMailTransport even if EMAIL is bound. */
  FORCE_MOCK_TRANSPORT?: string;
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
  if (error instanceof ValidationError) {
    return json({ error: error.code, message: error.message }, 400);
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

function match(pathname: string, pattern: RegExp): RegExpMatchArray | null {
  return pathname.match(pattern);
}

function parseBooleanParam(value: string | null): boolean | null {
  if (value == null || value === '') return null;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return null;
}

function blobDeps(env: Env, publicBaseUrl: string) {
  return {
    db: env.DB,
    r2: env.ATTACHMENTS,
    blobSigningSecret: env.INGEST_HMAC_SECRET,
    publicBaseUrl,
  };
}

function createTransport(env: Env) {
  if (env.FORCE_MOCK_TRANSPORT === 'true' || !env.EMAIL) {
    return new MockMailTransport({
      onSend(message) {
        console.log('[MockMailTransport] send', {
          from: message.from.address,
          to: message.to.map((r) => r.address),
          subject: message.subject,
        });
      },
    });
  }
  return new CloudflareEmailTransport(env.EMAIL);
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
          blobDeps(env, publicBaseUrl),
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

    const draftContentMatch = match(
      pathname,
      /^\/api\/draft-attachments\/([^/]+)\/content$/,
    );
    if (request.method === 'GET' && draftContentMatch) {
      const attachmentId = draftContentMatch[1]!;
      const token = url.searchParams.get('token') ?? '';
      try {
        const file = await openDraftAttachmentContent(
          blobDeps(env, publicBaseUrl),
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

      const searchMatch = match(pathname, /^\/api\/mailboxes\/([^/]+)\/search$/);
      if (request.method === 'GET' && searchMatch) {
        const result = await searchMessages(deps, ctx, {
          mailboxId: searchMatch[1]!,
          q: url.searchParams.get('q'),
          from: url.searchParams.get('from'),
          to: url.searchParams.get('to'),
          subject: url.searchParams.get('subject'),
          after: url.searchParams.get('after'),
          before: url.searchParams.get('before'),
          unread: parseBooleanParam(url.searchParams.get('unread')),
          hasAttachment: parseBooleanParam(url.searchParams.get('hasAttachment')),
          labelSlug: url.searchParams.get('label'),
          limit: Number(url.searchParams.get('limit') ?? 25),
        });
        return json(result);
      }

      const draftsMatch = match(pathname, /^\/api\/mailboxes\/([^/]+)\/drafts$/);
      if (draftsMatch) {
        const mailboxId = draftsMatch[1]!;
        if (request.method === 'GET') {
          return json({
            drafts: await listDrafts(deps, ctx, mailboxId),
          });
        }
        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const input: Parameters<typeof createDraft>[2] = { mailboxId };
          if (body.threadId !== undefined) {
            input.threadId = body.threadId as string | null;
          }
          if (body.to !== undefined) {
            input.to = body.to as Array<{ address: string; name?: string }>;
          }
          if (body.cc !== undefined) {
            input.cc = body.cc as Array<{ address: string; name?: string }>;
          }
          if (body.bcc !== undefined) {
            input.bcc = body.bcc as Array<{ address: string; name?: string }>;
          }
          if (body.subject !== undefined) {
            input.subject = body.subject as string | null;
          }
          if (body.bodyText !== undefined) {
            input.bodyText = body.bodyText as string | null;
          }
          if (body.bodyHtml !== undefined) {
            input.bodyHtml = body.bodyHtml as string | null;
          }
          if (body.inReplyToMessageId !== undefined) {
            input.inReplyToMessageId = body.inReplyToMessageId as string | null;
          }
          const draft = await createDraft(deps, ctx, input);
          return json({ draft }, 201);
        }
      }

      const replyDraftMatch = match(pathname, /^\/api\/messages\/([^/]+)\/reply-draft$/);
      if (request.method === 'POST' && replyDraftMatch) {
        return json(
          { draft: await createReplyDraft(deps, ctx, replyDraftMatch[1]!) },
          201,
        );
      }

      const forwardDraftMatch = match(
        pathname,
        /^\/api\/messages\/([^/]+)\/forward-draft$/,
      );
      if (request.method === 'POST' && forwardDraftMatch) {
        return json(
          { draft: await createForwardDraft(deps, ctx, forwardDraftMatch[1]!) },
          201,
        );
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

      const draftSendMatch = match(pathname, /^\/api\/drafts\/([^/]+)\/send$/);
      if (request.method === 'POST' && draftSendMatch) {
        const body = await request.json().catch(() => ({}));
        const result = await sendDraft(
          {
            db: env.DB,
            r2: env.ATTACHMENTS,
            transport: createTransport(env),
          },
          ctx,
          draftSendMatch[1]!,
          body,
        );
        return json(result, result.ok ? 200 : 502);
      }

      const draftMatch = match(pathname, /^\/api\/drafts\/([^/]+)$/);
      if (draftMatch) {
        const draftId = draftMatch[1]!;
        if (request.method === 'GET') {
          return json({ draft: await getDraft(deps, ctx, draftId) });
        }
        if (request.method === 'PATCH') {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const patch: Parameters<typeof updateDraft>[3] = {};
          if (body.to !== undefined) {
            patch.to = body.to as Array<{ address: string; name?: string }>;
          }
          if (body.cc !== undefined) {
            patch.cc = body.cc as Array<{ address: string; name?: string }>;
          }
          if (body.bcc !== undefined) {
            patch.bcc = body.bcc as Array<{ address: string; name?: string }>;
          }
          if (body.subject !== undefined) patch.subject = body.subject as string | null;
          if (body.bodyText !== undefined) patch.bodyText = body.bodyText as string | null;
          if (body.bodyHtml !== undefined) patch.bodyHtml = body.bodyHtml as string | null;
          if (body.threadId !== undefined) patch.threadId = body.threadId as string | null;
          if (body.inReplyToMessageId !== undefined) {
            patch.inReplyToMessageId = body.inReplyToMessageId as string | null;
          }
          const draft = await updateDraft(deps, ctx, draftId, patch);
          return json({ draft });
        }
        if (request.method === 'DELETE') {
          await deleteDraft(deps, ctx, draftId);
          return json({ ok: true });
        }
      }

      const draftAttachmentsMatch = match(
        pathname,
        /^\/api\/drafts\/([^/]+)\/attachments$/,
      );
      if (draftAttachmentsMatch) {
        const draftId = draftAttachmentsMatch[1]!;
        if (request.method === 'GET') {
          return json({
            attachments: await listDraftAttachments(deps, ctx, draftId),
          });
        }
        if (request.method === 'POST') {
          const filename =
            request.headers.get('x-yfm-filename')?.trim() ||
            url.searchParams.get('filename') ||
            'attachment';
          const contentType =
            request.headers.get('content-type')?.split(';')[0]?.trim() ||
            'application/octet-stream';
          const buffer = new Uint8Array(await request.arrayBuffer());
          const attachment = await uploadDraftAttachment(
            blobDeps(env, publicBaseUrl),
            ctx,
            draftId,
            { filename, contentType, bytes: buffer },
          );
          return json({ attachment }, 201);
        }
      }

      const attachmentMatch = match(pathname, /^\/api\/attachments\/([^/]+)$/);
      if (request.method === 'GET' && attachmentMatch) {
        return json({
          attachment: await getAttachment(
            blobDeps(env, publicBaseUrl),
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
            blobDeps(env, publicBaseUrl),
            ctx,
            attachmentUrlMatch[1]!,
          ),
        );
      }

      const draftAttachmentUrlMatch = match(
        pathname,
        /^\/api\/draft-attachments\/([^/]+)\/url$/,
      );
      if (request.method === 'POST' && draftAttachmentUrlMatch) {
        return json(
          await createDraftAttachmentDownloadUrl(
            blobDeps(env, publicBaseUrl),
            ctx,
            draftAttachmentUrlMatch[1]!,
          ),
        );
      }
    } catch (error) {
      return errorResponse(error);
    }

    return json({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler<Env>;
