import {
  SESSION_COOKIE_NAME,
  sha256Hex,
} from '@your-flare-mails/core';

export type CookieOptions = {
  maxAgeSeconds: number;
  secure: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
};

export function buildSessionCookie(
  sessionToken: string,
  options: CookieOptions,
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    `Path=${options.path ?? '/'}`,
    `HttpOnly`,
    `SameSite=${options.sameSite ?? 'Lax'}`,
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(options: { secure: boolean; sameSite?: 'Lax' | 'Strict' | 'None' }): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    `SameSite=${options.sameSite ?? 'Lax'}`,
    'Max-Age=0',
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function hashIp(ip: string): Promise<string> {
  return sha256Hex(ip);
}

/**
 * Reflect CORS for credentialed browser clients (Nuxt on another local port).
 * Never use `*` when credentials are involved.
 */
export function applyCorsHeaders(
  request: Request,
  response: Response,
  allowedOrigins: string[],
): Response {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins.includes(origin)) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsPreflightResponse(
  request: Request,
  allowedOrigins: string[],
): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':
        'content-type,authorization,x-yfm-csrf,x-yfm-user-id,x-yfm-filename',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}

export function parseCorsOrigins(raw: string | undefined, fallback: string[]): string[] {
  if (!raw?.trim()) return fallback;
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function securityHeaders(): HeadersInit {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  };
}
