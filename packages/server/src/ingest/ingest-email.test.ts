import { describe, expect, it } from 'vitest';

import {
  IngestRequestSchema,
  signIngestBody,
  type IngestRequest,
} from '@your-flare-mails/core';

import { ingestEmail } from './ingest-email.js';

describe('ingestEmail HMAC gate', () => {
  it('rejects bad signatures before touching storage', async () => {
    const result = await ingestEmail(
      {
        db: {
          prepare() {
            throw new Error('should not touch db');
          },
          batch() {
            throw new Error('should not touch db');
          },
        },
        r2: {
          put() {
            throw new Error('should not touch r2');
          },
        },
        hmacSecret: 'secret',
      },
      {
        rawBody: '{"timestamp":1,"nonce":"abc","email":{}}',
        signatureHex: '00'.repeat(32),
        timestampSeconds: Math.floor(Date.now() / 1000),
        nonce: 'abc',
      },
    );

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.code).toBe('bad_signature');
    }
  });

  it('accepts a well-signed body then rejects invalid payload', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ timestamp, nonce: 'nonce-123456', email: {} });
    const signature = await signIngestBody({ secret: 'secret', body });

    const result = await ingestEmail(
      {
        db: {
          prepare() {
            throw new Error('should not touch db for invalid payload');
          },
          batch() {
            throw new Error('should not touch db');
          },
        },
        r2: {
          put() {
            throw new Error('should not touch r2');
          },
        },
        hmacSecret: 'secret',
      },
      {
        rawBody: body,
        signatureHex: signature,
        timestampSeconds: timestamp,
        nonce: 'nonce-123456',
      },
    );

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.code).toBe('invalid_payload');
    }
  });
});

describe('IngestRequestSchema', () => {
  it('parses a complete ingest request', () => {
    const request: IngestRequest = {
      timestamp: 1_700_000_000,
      nonce: 'nonce-abcdef12',
      email: {
        envelopeFrom: 'alice@example.com',
        envelopeTo: 'hello@example.com',
        messageIdHeader: '<a@example.com>',
        inReplyTo: null,
        referencesHeader: null,
        fromAddress: 'alice@example.com',
        fromName: 'Alice',
        replyTo: null,
        to: [{ address: 'hello@example.com', name: null }],
        cc: [],
        subject: 'Hi',
        date: '2026-01-01T00:00:00.000Z',
        text: 'Hello',
        html: null,
        fingerprint: 'a'.repeat(64),
        rawMimeBase64: btoa('raw'),
        rawSizeBytes: 3,
        attachments: [],
      },
    };

    expect(IngestRequestSchema.parse(request).email.subject).toBe('Hi');
  });
});
