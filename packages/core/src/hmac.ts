/**
 * HMAC-SHA256 request signing for Worker → backend ingestion.
 * Constant-time comparison only — never use === on signatures.
 */

const encoder = new TextEncoder();

export const INGEST_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export type SignIngestBodyOptions = {
  secret: string;
  body: string | Uint8Array;
};

export type VerifyIngestSignatureOptions = {
  secret: string;
  body: string | Uint8Array;
  signatureHex: string;
  /** Unix timestamp (seconds) from the signed payload / header. */
  timestampSeconds: number;
  nowSeconds?: number;
  toleranceSeconds?: number;
};

function toBytes(data: string | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof data === 'string') {
    return encoder.encode(data);
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  const normalized = hex.trim().toLowerCase().replace(/^sha256=/, '');
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    return null;
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Constant-time equality for equal-length byte arrays. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export async function signIngestBody(options: SignIngestBodyOptions): Promise<string> {
  const key = await importHmacKey(options.secret);
  const mac = await crypto.subtle.sign('HMAC', key, toBytes(options.body));
  return bytesToHex(mac);
}

export type VerifyIngestSignatureResult =
  | { ok: true }
  | { ok: false; reason: 'bad_signature' | 'bad_timestamp' | 'bad_format' };

export async function verifyIngestSignature(
  options: VerifyIngestSignatureOptions,
): Promise<VerifyIngestSignatureResult> {
  const expectedBytes = hexToBytes(options.signatureHex);
  if (!expectedBytes) {
    return { ok: false, reason: 'bad_format' };
  }

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? INGEST_TIMESTAMP_TOLERANCE_SECONDS;
  if (
    !Number.isFinite(options.timestampSeconds) ||
    Math.abs(now - options.timestampSeconds) > tolerance
  ) {
    return { ok: false, reason: 'bad_timestamp' };
  }

  const key = await importHmacKey(options.secret);
  const actual = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, toBytes(options.body)),
  );

  if (!timingSafeEqual(actual, expectedBytes)) {
    return { ok: false, reason: 'bad_signature' };
  }

  return { ok: true };
}

/** Header names used by the email-receiver → ingest API contract. */
export const INGEST_SIGNATURE_HEADER = 'x-yfm-signature';
export const INGEST_TIMESTAMP_HEADER = 'x-yfm-timestamp';
export const INGEST_NONCE_HEADER = 'x-yfm-nonce';
