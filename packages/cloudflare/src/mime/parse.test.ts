import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseMimeToNormalizedEmail } from './parse.js';

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/emails',
);

describe('parseMimeToNormalizedEmail', () => {
  it('parses a plain-text fixture', async () => {
    const raw = await readFile(path.join(fixturesDir, 'plain-text.eml'));
    const result = await parseMimeToNormalizedEmail({
      raw,
      envelopeFrom: 'noreply@mail.example.com',
      envelopeTo: 'hello@example.com',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email.subject).toBe('Welcome to YourFlareMails');
    expect(result.email.text).toContain('plain-text seed message');
    expect(result.email.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.email.messageIdHeader).toContain('fixture-plain-text@mail.example.com');
  });

  it('parses multipart HTML + attachment', async () => {
    const raw = await readFile(path.join(fixturesDir, 'multipart-html-attachment.eml'));
    const result = await parseMimeToNormalizedEmail({
      raw,
      envelopeFrom: 'billing@example.com',
      envelopeTo: 'hello@example.com',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email.html).toContain('invoice');
    expect(result.email.attachments.length).toBeGreaterThanOrEqual(1);
    expect(result.email.attachments[0]?.filename).toContain('invoice');
  });

  it('handles missing Message-ID via content fingerprint', async () => {
    const raw = await readFile(path.join(fixturesDir, 'missing-threading-headers.eml'));
    const result = await parseMimeToNormalizedEmail({
      raw,
      envelopeFrom: 'alice@example.com',
      envelopeTo: 'hello@example.com',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email.messageIdHeader).toBeNull();
    expect(result.email.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails soft on malformed MIME', async () => {
    const raw = await readFile(path.join(fixturesDir, 'malformed-mime.eml'));
    const result = await parseMimeToNormalizedEmail({
      raw,
      envelopeFrom: 'mallory@example.com',
      envelopeTo: 'hello@example.com',
    });

    // postal-mime may still return a partial parse; either ok with limited data or soft fail is fine.
    // Ensure we never throw.
    expect(result).toBeTruthy();
    if (result.ok) {
      expect(result.email.fingerprint).toBeTruthy();
    } else {
      expect(result.error).toBeTruthy();
    }
  });
});
