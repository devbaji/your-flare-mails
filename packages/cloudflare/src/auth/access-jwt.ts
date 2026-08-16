/**
 * Optional Cloudflare Access JWT verification (personal / single-user deployments).
 * Uses Web Crypto + team JWKS — no extra JWT library dependency.
 */

export type AccessIdentity = {
  email: string;
  sub?: string;
};

type Jwk = JsonWebKey & { kid?: string; kty: string };

type JwksCache = {
  fetchedAt: number;
  keys: Map<string, CryptoKey>;
};

const jwksCacheByTeam = new Map<string, JwksCache>();
const JWKS_TTL_MS = 60 * 60 * 1000;

function normalizeTeamDomain(teamDomain: string): string {
  const trimmed = teamDomain.trim().replace(/\/$/, '');
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function decodeJwtPart(part: string): unknown {
  const json = new TextDecoder().decode(base64UrlToBytes(part));
  return JSON.parse(json);
}

async function loadJwks(teamDomain: string): Promise<Map<string, CryptoKey>> {
  const normalized = normalizeTeamDomain(teamDomain);
  const cached = jwksCacheByTeam.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.keys;
  }

  const response = await fetch(`${normalized}/cdn-cgi/access/certs`);
  if (!response.ok) {
    throw new Error(`failed to fetch Access JWKS (${response.status})`);
  }
  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid || jwk.kty !== 'RSA') continue;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    keys.set(jwk.kid, key);
  }
  jwksCacheByTeam.set(normalized, { fetchedAt: Date.now(), keys });
  return keys;
}

/**
 * Verify Cloudflare Access application JWT from `Cf-Access-Jwt-Assertion`.
 */
export async function verifyCloudflareAccessJwt(options: {
  token: string;
  teamDomain: string;
  audience: string;
  nowSeconds?: number;
}): Promise<AccessIdentity | null> {
  const parts = options.token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  let payload: {
    email?: string;
    sub?: string;
    aud?: string | string[];
    iss?: string;
    exp?: number;
  };
  try {
    header = decodeJwtPart(headerB64) as typeof header;
    payload = decodeJwtPart(payloadB64) as typeof payload;
  } catch {
    return null;
  }

  if (header.alg !== 'RS256' || !header.kid) return null;

  const team = normalizeTeamDomain(options.teamDomain);
  if (payload.iss !== team && payload.iss !== `${team}/`) return null;

  const aud = payload.aud;
  const audList = Array.isArray(aud) ? aud : aud ? [aud] : [];
  if (!audList.includes(options.audience)) return null;

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;

  const keys = await loadJwks(team);
  const key = keys.get(header.kid);
  if (!key) return null;

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBytes(signatureB64);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature.buffer.slice(
      signature.byteOffset,
      signature.byteOffset + signature.byteLength,
    ) as ArrayBuffer,
    data,
  );
  if (!ok) return null;

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!email) return null;
  return {
    email,
    ...(typeof payload.sub === 'string' ? { sub: payload.sub } : {}),
  };
}
