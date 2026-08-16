/**
 * Password hashing via PBKDF2-SHA-256 (Web Crypto — Workers + Node compatible).
 * Format: pbkdf2$<iterations>$<saltHex>$<hashHex>
 */

const encoder = new TextEncoder();

/** Cloudflare Workers reject PBKDF2 above 100_000 iterations. */
export const PASSWORD_PBKDF2_ITERATIONS = 100_000;
export const PASSWORD_SALT_BYTES = 16;
export const PASSWORD_HASH_BYTES = 32;

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      // BufferSource — copy into a plain ArrayBuffer for TS DOM lib compatibility
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations,
    },
    keyMaterial,
    PASSWORD_HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(
  password: string,
  options: { iterations?: number; salt?: Uint8Array } = {},
): Promise<string> {
  const iterations = options.iterations ?? PASSWORD_PBKDF2_ITERATIONS;
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2$${iterations}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

export async function verifyPassword(
  password: string,
  encoded: string | null | undefined,
): Promise<boolean> {
  if (!encoded) return false;
  const parts = encoded.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number.parseInt(parts[1]!, 10);
  const salt = hexToBytes(parts[2]!);
  const expected = hexToBytes(parts[3]!);
  if (!Number.isFinite(iterations) || iterations < 10_000 || !salt || !expected) {
    return false;
  }
  const actual = await derive(password, salt, iterations);
  if (actual.byteLength !== expected.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < actual.byteLength; i += 1) {
    diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
  }
  return diff === 0;
}
