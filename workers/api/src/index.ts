import {
  INGEST_NONCE_HEADER,
  INGEST_SIGNATURE_HEADER,
  INGEST_TIMESTAMP_HEADER,
  MockMailTransport,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  type MailboxRealtimeEvent,
} from '@your-flare-mails/core';
import {
  CloudflareEmailTransport,
  CloudflarePushTransport,
  MailboxRealtime,
  MessageRepository,
  MockPushTransport,
  consumeRateLimit,
  notifyMailboxRealtime,
  pollMailboxRealtime,
  upgradeMailboxRealtimeWebSocket,
  type PushTransport,
  type SendEmailBinding,
} from '@your-flare-mails/cloudflare';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  applyCorsHeaders,
  assertCsrf,
  buildSessionCookie,
  clearSessionCookie,
  clientIp,
  corsPreflightResponse,
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
  applyThreadFolderAction,
  getThread,
  hashIp,
  ingestEmail,
  listDraftAttachments,
  listDrafts,
  listMailboxes,
  listThreadMessages,
  listThreads,
  loginWithPassword,
  logoutSession,
  notifyMailboxDevices,
  openAttachmentContent,
  openDraftAttachmentContent,
  parseCorsOrigins,
  registerDevice,
  resolveRequestAuth,
  searchMessages,
  securityHeaders,
  sendDraft,
  subscribeDeviceToMailbox,
  unregisterDevice,
  updateDraft,
  uploadDraftAttachment,
  type AuthenticatedSession,
} from '@your-flare-mails/server';

export { MailboxRealtime };

export interface Env {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  INGEST_HMAC_SECRET: string;
  /** Separate secret for attachment URL tokens; falls back to ingest secret. */
  BLOB_SIGNING_SECRET?: string;
  /** Session signing is DB-backed; this gates Secure cookie + optional pepper docs. */
  SESSION_SECURE_COOKIES?: string;
  /** Comma-separated browser origins allowed for credentialed CORS. */
  CORS_ORIGINS?: string;
  /** When "true", allow spoofable x-yfm-user-id / ?userId= (local emergency only). */
  ALLOW_DEV_USER_HEADER?: string;
  /** Cloudflare Access team domain (optional alternate auth). */
  CF_ACCESS_TEAM_DOMAIN?: string;
  /** Cloudflare Access application audience (AUD). */
  CF_ACCESS_AUD?: string;
  PUBLIC_BASE_URL?: string;
  EMAIL?: SendEmailBinding;
  FORCE_MOCK_TRANSPORT?: string;
  FORCE_MOCK_PUSH?: string;
  APNS_TEAM_ID?: string;
  APNS_KEY_ID?: string;
  APNS_PRIVATE_KEY_PEM?: string;
  APNS_BUNDLE_ID?: string;
  APNS_PRODUCTION?: string;
  FCM_SERVICE_ACCOUNT_JSON?: string;
  MAILBOX_REALTIME: DurableObjectNamespace;
}

const DEFAULT_CORS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'tauri://localhost',
];

function json(
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    ...securityHeaders(),
  });
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(error: unknown): Response {
  if (error instanceof AuthenticationError) {
    return json({ error: error.code, message: error.message }, 401);
  }
  if (error instanceof RateLimitError) {
    return json(
      { error: error.code, message: error.message },
      429,
      { 'retry-after': String(error.retryAfterSeconds) },
    );
  }
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

function match(pathname: string, pattern: RegExp): RegExpMatchArray | null {
  return pathname.match(pattern);
}

function parseBooleanParam(value: string | null): boolean | null {
  if (value == null || value === '') return null;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return null;
}

function blobSigningSecret(env: Env): string {
  return env.BLOB_SIGNING_SECRET || env.INGEST_HMAC_SECRET;
}

function blobDeps(env: Env, publicBaseUrl: string) {
  return {
    db: env.DB,
    r2: env.ATTACHMENTS,
    blobSigningSecret: blobSigningSecret(env),
    publicBaseUrl,
  };
}

function authDeps(env: Env) {
  const deps: {
    db: D1Database;
    allowDevUserHeader: boolean;
    accessTeamDomain?: string;
    accessAudience?: string;
  } = {
    db: env.DB,
    allowDevUserHeader: env.ALLOW_DEV_USER_HEADER === 'true',
  };
  if (env.CF_ACCESS_TEAM_DOMAIN) deps.accessTeamDomain = env.CF_ACCESS_TEAM_DOMAIN;
  if (env.CF_ACCESS_AUD) deps.accessAudience = env.CF_ACCESS_AUD;
  return deps;
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

async function notifyMailbox(env: Env, event: MailboxRealtimeEvent): Promise<void> {
  const result = await notifyMailboxRealtime(env.MAILBOX_REALTIME, event);
  if (!result.ok) {
    console.error('[realtime] notify failed', result.error);
  }

  if (event.type !== 'message.created' && event.type !== 'message.sent') {
    return;
  }

  let subject: string | null = null;
  try {
    const message = await new MessageRepository(env.DB).findById(event.messageId);
    subject = message?.subject?.trim() || null;
  } catch (error) {
    console.error('[push] subject lookup failed', error);
  }

  const title = event.type === 'message.created' ? 'New mail' : 'Message sent';
  const body =
    subject ||
    (event.type === 'message.created'
      ? 'A new message arrived in your mailbox'
      : 'Your message was sent');

  try {
    await notifyMailboxDevices(
      { db: env.DB, push: createPushTransport(env) },
      event.mailboxId,
      {
        title,
        body,
        data: {
          type: event.type,
          mailboxId: event.mailboxId,
          messageId: event.messageId,
          threadId: event.threadId,
          subject: subject ?? '',
        },
      },
    );
  } catch (error) {
    console.error('[push] notify failed', error);
  }
}

function createPushTransport(env: Env): PushTransport {
  const mock = new MockPushTransport();
  if (env.FORCE_MOCK_PUSH === 'true') {
    return mock;
  }

  const apns =
    env.APNS_TEAM_ID &&
    env.APNS_KEY_ID &&
    env.APNS_PRIVATE_KEY_PEM &&
    env.APNS_BUNDLE_ID
      ? {
          teamId: env.APNS_TEAM_ID,
          keyId: env.APNS_KEY_ID,
          privateKeyPem: env.APNS_PRIVATE_KEY_PEM.replace(/\\n/g, '\n'),
          bundleId: env.APNS_BUNDLE_ID,
          production: env.APNS_PRODUCTION === 'true',
        }
      : undefined;

  const fcm = env.FCM_SERVICE_ACCOUNT_JSON
    ? { serviceAccountJson: env.FCM_SERVICE_ACCOUNT_JSON }
    : undefined;

  if (!apns && !fcm) {
    return mock;
  }

  return new CloudflarePushTransport({
    ...(apns ? { apns } : {}),
    ...(fcm ? { fcm } : {}),
    fallback: mock,
  });
}

function secureCookies(env: Env, request: Request): boolean {
  if (env.SESSION_SECURE_COOKIES === 'true') return true;
  if (env.SESSION_SECURE_COOKIES === 'false') return false;
  return new URL(request.url).protocol === 'https:';
}

function parseSessionTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get('authorization');
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

async function enforceRateLimit(
  env: Env,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const result = await consumeRateLimit(env.DB, bucketKey, limit, windowSeconds);
  if (!result.ok) {
    throw new RateLimitError('rate limit exceeded', result.retryAfterSeconds);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Always include DEFAULT_CORS (Tauri Android/iOS webview origins) so APK/IPA
    // API calls work even when CORS_ORIGINS is set to the public web origin only.
    const corsOrigins = [
      ...new Set([
        ...DEFAULT_CORS,
        ...parseCorsOrigins(env.CORS_ORIGINS, []),
      ]),
    ];
    const preflight = corsPreflightResponse(request, corsOrigins);
    if (preflight) return preflight;

    const respond = (response: Response) =>
      applyCorsHeaders(request, response, corsOrigins);

    try {
      return respond(await handleRequest(request, env));
    } catch (error) {
      return respond(errorResponse(error));
    }
  },
} satisfies ExportedHandler<Env>;

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const publicBaseUrl = env.PUBLIC_BASE_URL || url.origin;
  const ip = clientIp(request);
  const ipDigest = await hashIp(ip);

  if (request.method === 'GET' && pathname === '/health') {
    return json({ ok: true, service: 'your-flare-mails-api' });
  }

  if (request.method === 'POST' && pathname === '/api/auth/login') {
    await enforceRateLimit(env, `auth:login:ip:${ipDigest}`, 20, 60);
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
      password?: unknown;
    };
    const email = typeof body.email === 'string' ? body.email : '';
    await enforceRateLimit(
      env,
      `auth:login:email:${email.trim().toLowerCase() || 'unknown'}`,
      10,
      60,
    );
    const result = await loginWithPassword(authDeps(env), {
      email,
      password: typeof body.password === 'string' ? body.password : '',
      userAgent: request.headers.get('user-agent'),
      ipHash: ipDigest,
    });
    const secure = secureCookies(env, request);
    return json(
      {
        user: result.user,
        csrfToken: result.csrfToken,
        expiresAt: result.expiresAt,
        // Returned for split-origin local/dev clients (Bearer). Prefer cookie when same-origin.
        sessionToken: result.sessionToken,
      },
      200,
      {
        'set-cookie': buildSessionCookie(result.sessionToken, {
          maxAgeSeconds: SESSION_TTL_SECONDS,
          secure,
          sameSite: secure ? 'None' : 'Lax',
        }),
      },
    );
  }

  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    await logoutSession(authDeps(env), parseSessionTokenFromRequest(request));
    const secure = secureCookies(env, request);
    return json(
      { ok: true },
      200,
      {
        'set-cookie': clearSessionCookie({
          secure,
          sameSite: secure ? 'None' : 'Lax',
        }),
      },
    );
  }

  if (request.method === 'POST' && pathname === '/api/inbound/email') {
    await enforceRateLimit(env, `ingest:ip:${ipDigest}`, 120, 60);
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
        notifyMailbox: (event) => notifyMailbox(env, event),
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

  // Tokenized attachment download — no session required (token is the capability).
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
          ...securityHeaders(),
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
          ...securityHeaders(),
        },
      });
    } catch (error) {
      return errorResponse(error);
    }
  }

  // WebSocket: prefer Bearer/cookie session; optional ?access_token= for browsers.
  const wsMatch = match(pathname, /^\/api\/mailboxes\/([^/]+)\/ws$/);
  if (wsMatch && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
    const mailboxId = wsMatch[1]!;
    const accessToken = url.searchParams.get('access_token')?.trim();
    const authRequest = accessToken
      ? new Request(request, {
          headers: (() => {
            const headers = new Headers(request.headers);
            headers.set('authorization', `Bearer ${accessToken}`);
            return headers;
          })(),
        })
      : request;
    try {
      const auth = await resolveRequestAuth(authDeps(env), authRequest);
      await getMailbox({ db: env.DB }, auth.ctx, mailboxId);
      return await upgradeMailboxRealtimeWebSocket(
        env.MAILBOX_REALTIME,
        mailboxId,
        request,
        { userId: auth.ctx.userId, connectedAt: new Date().toISOString() },
      );
    } catch (error) {
      return errorResponse(error);
    }
  }

  let auth: AuthenticatedSession;
  try {
    auth = await resolveRequestAuth(authDeps(env), request);
    assertCsrf(auth, request);
  } catch (error) {
    return errorResponse(error);
  }

  const ctx = auth.ctx;
  const deps = { db: env.DB, r2: env.ATTACHMENTS };

  try {
    if (request.method === 'GET' && pathname === '/api/auth/me') {
      return json({
        user: {
          id: auth.user.id,
          email: auth.user.email,
          displayName: auth.user.displayName,
          createdAt: auth.user.createdAt,
          updatedAt: auth.user.updatedAt,
        },
        via: auth.via,
        csrfToken: auth.csrfToken,
      });
    }

    if (request.method === 'POST' && pathname === '/api/devices') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const device = await registerDevice(
        { db: env.DB },
        ctx,
        {
          platform: body.platform,
          pushEndpoint: body.pushEndpoint,
          pushKeysJson: body.pushKeysJson,
          mailboxId: body.mailboxId,
        },
      );
      return json({ device }, 201);
    }

    const deviceMatch = match(pathname, /^\/api\/devices\/([^/]+)$/);
    if (request.method === 'DELETE' && deviceMatch) {
      await unregisterDevice({ db: env.DB }, ctx, deviceMatch[1]!);
      return json({ ok: true });
    }

    const deviceMailboxMatch = match(
      pathname,
      /^\/api\/devices\/([^/]+)\/mailboxes\/([^/]+)$/,
    );
    if (request.method === 'POST' && deviceMailboxMatch) {
      await subscribeDeviceToMailbox(
        { db: env.DB },
        ctx,
        deviceMailboxMatch[1]!,
        deviceMailboxMatch[2]!,
      );
      return json({ ok: true });
    }

    if (request.method === 'GET' && pathname === '/api/mailboxes') {
      return json({ mailboxes: await listMailboxes(deps, ctx) });
    }

    const mailboxMatch = match(pathname, /^\/api\/mailboxes\/([^/]+)$/);
    if (request.method === 'GET' && mailboxMatch) {
      return json({ mailbox: await getMailbox(deps, ctx, mailboxMatch[1]!) });
    }

    const pollMatch = match(pathname, /^\/api\/mailboxes\/([^/]+)\/events\/poll$/);
    if (request.method === 'GET' && pollMatch) {
      const mailboxId = pollMatch[1]!;
      await getMailbox(deps, ctx, mailboxId);
      const since = Number.parseInt(url.searchParams.get('since') ?? '0', 10);
      const result = await pollMailboxRealtime(
        env.MAILBOX_REALTIME,
        mailboxId,
        Number.isFinite(since) ? since : 0,
      );
      return json(result);
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
        return json({ drafts: await listDrafts(deps, ctx, mailboxId) });
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

    const threadFolderMatch = match(
      pathname,
      /^\/api\/threads\/([^/]+)\/(archive|trash|inbox)$/,
    );
    if (request.method === 'POST' && threadFolderMatch) {
      assertCsrf(auth, request);
      const threadId = threadFolderMatch[1]!;
      const action = threadFolderMatch[2] as 'archive' | 'trash' | 'inbox';
      return json({
        thread: await applyThreadFolderAction(deps, ctx, threadId, action),
      });
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
          notifyMailbox: (event) => notifyMailbox(env, event),
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

    const attachmentUrlMatch = match(pathname, /^\/api\/attachments\/([^/]+)\/url$/);
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
}
