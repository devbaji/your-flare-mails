import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.js';
import { generateOpaqueToken, sha256Hex, timingSafeEqualHex } from './session-token.js';

describe('password hashing', () => {
  it('verifies a matching password', async () => {
    const encoded = await hashPassword('owner-dev-password');
    expect(encoded.startsWith('pbkdf2$')).toBe(true);
    expect(await verifyPassword('owner-dev-password', encoded)).toBe(true);
    expect(await verifyPassword('wrong', encoded)).toBe(false);
  });
});

describe('session tokens', () => {
  it('hashes and compares hex digests', async () => {
    const token = generateOpaqueToken();
    const hash = await sha256Hex(token);
    expect(hash).toHaveLength(64);
    expect(await timingSafeEqualHex(hash, await sha256Hex(token))).toBe(true);
    expect(await timingSafeEqualHex(hash, await sha256Hex('other'))).toBe(false);
  });
});
