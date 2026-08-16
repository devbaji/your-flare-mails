import { describe, expect, it } from 'vitest';

import {
  signIngestBody,
  timingSafeEqual,
  verifyIngestSignature,
} from './hmac.js';

describe('timingSafeEqual', () => {
  it('returns true for identical bytes', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(
      true,
    );
  });

  it('returns false for different lengths without throwing', () => {
    expect(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe('ingest HMAC', () => {
  it('signs and verifies a body', async () => {
    const secret = 'test-secret';
    const body = JSON.stringify({ hello: 'world', timestamp: 1 });
    const signature = await signIngestBody({ secret, body });
    const now = Math.floor(Date.now() / 1000);

    const ok = await verifyIngestSignature({
      secret,
      body,
      signatureHex: signature,
      timestampSeconds: now,
      nowSeconds: now,
    });
    expect(ok).toEqual({ ok: true });
  });

  it('rejects a bad signature', async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await verifyIngestSignature({
      secret: 'test-secret',
      body: 'payload',
      signatureHex: 'ab'.repeat(32),
      timestampSeconds: now,
      nowSeconds: now,
    });
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects an expired timestamp', async () => {
    const secret = 'test-secret';
    const body = 'payload';
    const signature = await signIngestBody({ secret, body });
    const result = await verifyIngestSignature({
      secret,
      body,
      signatureHex: signature,
      timestampSeconds: 1_700_000_000,
      nowSeconds: 1_700_000_000 + 10 * 60,
    });
    expect(result).toEqual({ ok: false, reason: 'bad_timestamp' });
  });
});
