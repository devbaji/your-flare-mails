/**
 * Opaque session / CSRF token helpers (Web Crypto).
 */

import { timingSafeEqual } from './hmac.js';

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Cryptographically random URL-safe token (hex). */
export function generateOpaqueToken(byteLength = 32): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** SHA-256 hex digest — store hashes, never raw session tokens. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function timingSafeEqualHex(a: string, b: string): Promise<boolean> {
  const left = hexToBytes(a);
  const right = hexToBytes(b);
  if (!left || !right) return false;
  return timingSafeEqual(left, right);
}

export const SESSION_COOKIE_NAME = 'yfm_session' as const;
export const CSRF_HEADER_NAME = 'x-yfm-csrf' as const;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
