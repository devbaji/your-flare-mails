import {
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  generateOpaqueToken,
  hashPassword,
  sha256Hex,
  verifyPassword,
  type User,
} from '@your-flare-mails/core';
import {
  SessionRepository,
  UserRepository,
  newId,
  verifyCloudflareAccessJwt,
  type D1Queryable,
  type SessionRecord,
  type UserRecord,
} from '@your-flare-mails/cloudflare';

import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  type AuthContext,
} from '../auth/context.js';

export type AuthServiceDeps = {
  db: D1Queryable;
  /** When true, allow spoofable x-yfm-user-id (local emergency only). */
  allowDevUserHeader?: boolean;
  /** Cloudflare Access team domain, e.g. https://example.cloudflareaccess.com */
  accessTeamDomain?: string;
  /** Cloudflare Access application AUD tag. */
  accessAudience?: string;
  sessionTtlSeconds?: number;
};

export type AuthenticatedSession = {
  ctx: AuthContext;
  user: UserRecord;
  session: SessionRecord | null;
  /** How identity was established. */
  via: 'session' | 'access' | 'dev_header';
  csrfToken: string | null;
};

export type LoginResult = {
  user: User;
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
};

function toPublicUser(user: UserRecord): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export class AuthenticationError extends Error {
  readonly code = 'unauthorized';
  constructor(message = 'authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends Error {
  readonly code = 'rate_limited';
  constructor(
    message = 'rate limit exceeded',
    readonly retryAfterSeconds = 60,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export async function loginWithPassword(
  deps: AuthServiceDeps,
  input: {
    email: string;
    password: string;
    userAgent?: string | null;
    ipHash?: string | null;
  },
): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    throw new ValidationError('email and password are required');
  }

  const users = new UserRepository(deps.db);
  const user = await users.findByEmail(email);
  // Constant-ish failure path: still hash when user missing.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? null);
  if (!user || !ok) {
    throw new AuthenticationError('invalid email or password');
  }

  const now = new Date();
  const ttl = deps.sessionTtlSeconds ?? SESSION_TTL_SECONDS;
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
  const sessionToken = generateOpaqueToken(32);
  const csrfToken = generateOpaqueToken(16);
  const tokenHash = await sha256Hex(sessionToken);
  const sessionId = newId('ses');

  await new SessionRepository(deps.db).create({
    id: sessionId,
    userId: user.id,
    tokenHash,
    csrfToken,
    expiresAt,
    createdAt: now.toISOString(),
    userAgent: input.userAgent ?? null,
    ipHash: input.ipHash ?? null,
  });

  return {
    user: toPublicUser(user),
    sessionToken,
    csrfToken,
    expiresAt,
  };
}

export async function logoutSession(
  deps: AuthServiceDeps,
  sessionToken: string | null | undefined,
): Promise<void> {
  if (!sessionToken) return;
  const tokenHash = await sha256Hex(sessionToken);
  await new SessionRepository(deps.db).deleteByTokenHash(tokenHash);
}

export async function resolveRequestAuth(
  deps: AuthServiceDeps,
  request: Request,
): Promise<AuthenticatedSession> {
  const users = new UserRepository(deps.db);
  const sessions = new SessionRepository(deps.db);
  const nowIso = new Date().toISOString();

  // 1) Session cookie or Bearer token
  const cookieToken = parseCookie(request.headers.get('cookie'), SESSION_COOKIE_NAME);
  const headerToken = bearerToken(request.headers.get('authorization'));
  const sessionToken = headerToken || cookieToken;

  if (sessionToken) {
    const tokenHash = await sha256Hex(sessionToken);
    const session = await sessions.findByTokenHash(tokenHash);
    if (!session || session.expiresAt < nowIso) {
      if (session) await sessions.deleteById(session.id);
      throw new AuthenticationError('session expired');
    }
    const user = await users.findById(session.userId);
    if (!user) throw new AuthenticationError('user not found');
    await sessions.touch(session.id, nowIso);
    return {
      ctx: { userId: user.id },
      user,
      session,
      via: 'session',
      csrfToken: session.csrfToken,
    };
  }

  // 2) Cloudflare Access JWT (optional)
  if (deps.accessTeamDomain && deps.accessAudience) {
    const assertion = request.headers.get('cf-access-jwt-assertion');
    if (assertion) {
      const identity = await verifyCloudflareAccessJwt({
        token: assertion,
        teamDomain: deps.accessTeamDomain,
        audience: deps.accessAudience,
      });
      if (!identity) throw new AuthenticationError('invalid Access token');
      const user = await users.findByEmail(identity.email);
      if (!user) {
        throw new AuthorizationError(
          'Access identity is not provisioned as a local user',
        );
      }
      return {
        ctx: { userId: user.id },
        user,
        session: null,
        via: 'access',
        csrfToken: null,
      };
    }
  }

  // 3) Dev-only spoofable header (disabled unless explicitly enabled)
  if (deps.allowDevUserHeader) {
    const url = new URL(request.url);
    const userId =
      request.headers.get('x-yfm-user-id')?.trim() ||
      url.searchParams.get('userId')?.trim() ||
      '';
    if (userId) {
      const user = await users.findById(userId);
      if (!user) throw new AuthenticationError('unknown user');
      return {
        ctx: { userId: user.id },
        user,
        session: null,
        via: 'dev_header',
        csrfToken: null,
      };
    }
  }

  throw new AuthenticationError();
}

/**
 * CSRF double-submit for cookie-authenticated mutating requests.
 * Bearer / Access / dev-header auth skips CSRF (not cookie-bound).
 */
export function assertCsrf(
  auth: AuthenticatedSession,
  request: Request,
): void {
  if (auth.via !== 'session') return;
  // Bearer presented the token in Authorization — not vulnerable to cookie CSRF.
  if (bearerToken(request.headers.get('authorization'))) return;
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const header = request.headers.get(CSRF_HEADER_NAME)?.trim();
  if (!header || !auth.csrfToken || header !== auth.csrfToken) {
    throw new AuthenticationError('invalid CSRF token');
  }
}

export async function setUserPassword(
  deps: AuthServiceDeps,
  userId: string,
  password: string,
): Promise<void> {
  if (password.length < 10) {
    throw new ValidationError('password must be at least 10 characters');
  }
  const users = new UserRepository(deps.db);
  const user = await users.findById(userId);
  if (!user) throw new NotFoundError('user not found');
  const passwordHash = await hashPassword(password);
  await users.setPasswordHash(userId, passwordHash, new Date().toISOString());
}

export { SESSION_COOKIE_NAME, CSRF_HEADER_NAME };
