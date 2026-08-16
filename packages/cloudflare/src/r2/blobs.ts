import { signIngestBody, timingSafeEqual } from '@your-flare-mails/core';

import type { R2BucketLike } from '../db.js';

export const DEFAULT_BLOB_URL_TTL_SECONDS = 5 * 60;

export type BlobAccessClaims = {
  resourceId: string;
  r2Key: string;
  exp: number;
};

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(token: string): string {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

/**
 * Short-lived app-signed blob access token.
 * Clients never receive a public R2 URL; they hit our API with this token.
 */
export async function createBlobAccessToken(
  secret: string,
  claims: BlobAccessClaims,
): Promise<string> {
  const payload = `${claims.resourceId}|${claims.r2Key}|${claims.exp}`;
  const sig = await signIngestBody({ secret, body: payload });
  return toBase64Url(`${payload}|${sig}`);
}

export async function verifyBlobAccessToken(
  secret: string,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ ok: true; claims: BlobAccessClaims } | { ok: false; reason: string }> {
  let decoded: string;
  try {
    decoded = fromBase64Url(token);
  } catch {
    return { ok: false, reason: 'bad_format' };
  }

  const parts = decoded.split('|');
  if (parts.length !== 4) {
    return { ok: false, reason: 'bad_format' };
  }
  const [resourceId, r2Key, expRaw, signatureHex] = parts;
  if (!resourceId || !r2Key || !expRaw || !signatureHex) {
    return { ok: false, reason: 'bad_format' };
  }
  const exp = Number.parseInt(expRaw, 10);
  if (!Number.isFinite(exp) || exp < nowSeconds) {
    return { ok: false, reason: 'expired' };
  }

  const payload = `${resourceId}|${r2Key}|${exp}`;
  const expected = await signIngestBody({ secret, body: payload });
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(signatureHex);
  if (!timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  return { ok: true, claims: { resourceId, r2Key, exp } };
}

export class R2BlobStore {
  constructor(private readonly bucket: R2BucketLike) {}

  async putBytes(
    key: string,
    bytes: Uint8Array,
    contentType = 'application/octet-stream',
  ): Promise<void> {
    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType },
    });
  }

  async getObject(key: string): Promise<{
    body: ReadableStream | ArrayBuffer;
    contentType: string;
    size: number;
  } | null> {
    if (!this.bucket.get) {
      throw new Error('R2 bucket binding does not support get()');
    }
    const obj = await this.bucket.get(key);
    if (!obj?.body) return null;
    return {
      body: obj.body,
      contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
      size: obj.size,
    };
  }
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
