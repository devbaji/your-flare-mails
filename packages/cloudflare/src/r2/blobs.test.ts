import { describe, expect, it } from 'vitest';

import {
  createBlobAccessToken,
  verifyBlobAccessToken,
} from './blobs.js';

describe('blob access tokens', () => {
  it('round-trips a valid token', async () => {
    const secret = 'blob-secret';
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = await createBlobAccessToken(secret, {
      resourceId: 'att_1',
      r2Key: 'mailboxes/mbx/attachments/a.pdf',
      exp,
    });
    const verified = await verifyBlobAccessToken(secret, token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.claims.resourceId).toBe('att_1');
      expect(verified.claims.r2Key).toContain('a.pdf');
    }
  });

  it('rejects expired tokens', async () => {
    const secret = 'blob-secret';
    const token = await createBlobAccessToken(secret, {
      resourceId: 'att_1',
      r2Key: 'key',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    const verified = await verifyBlobAccessToken(secret, token);
    expect(verified).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects tampered tokens', async () => {
    const secret = 'blob-secret';
    const token = await createBlobAccessToken(secret, {
      resourceId: 'att_1',
      r2Key: 'key',
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const verified = await verifyBlobAccessToken(secret, `${token}tamper`);
    expect(verified.ok).toBe(false);
  });
});
