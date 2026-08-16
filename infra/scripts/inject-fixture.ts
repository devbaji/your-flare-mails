/**
 * Inject a fixture .eml through the same HMAC-signed ingest path used in production.
 *
 * Usage:
 *   pnpm ingest:fixture fixtures/emails/plain-text.eml
 *
 * Requires the API worker:
 *   pnpm --filter @your-flare-mails/api dev
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  INGEST_NONCE_HEADER,
  INGEST_SIGNATURE_HEADER,
  INGEST_TIMESTAMP_HEADER,
  signIngestBody,
} from '@your-flare-mails/core';
import { parseMimeToNormalizedEmail } from '@your-flare-mails/cloudflare';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const DEFAULT_TO = 'hello@example.com';
const DEFAULT_FROM = 'alice@example.com';
const DEFAULT_URL = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';
const DEFAULT_SECRET =
  process.env.INGEST_HMAC_SECRET ?? 'dev-ingest-hmac-secret-change-me';

async function main(): Promise<void> {
  const fixtureArg = process.argv[2];
  if (!fixtureArg) {
    console.error('Usage: pnpm ingest:fixture <path-to.eml>');
    process.exitCode = 1;
    return;
  }

  const fixturePath = path.isAbsolute(fixtureArg)
    ? fixtureArg
    : path.resolve(repoRoot, fixtureArg);
  const raw = await readFile(fixturePath);

  const parsed = await parseMimeToNormalizedEmail({
    raw,
    envelopeFrom: process.env.ENVELOPE_FROM ?? DEFAULT_FROM,
    envelopeTo: process.env.ENVELOPE_TO ?? DEFAULT_TO,
  });

  if (!parsed.ok) {
    console.error('Failed to parse fixture:', parsed.error);
    process.exitCode = 1;
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const body = JSON.stringify({
    timestamp,
    nonce,
    email: parsed.email,
  });
  const signature = await signIngestBody({ secret: DEFAULT_SECRET, body });

  const response = await fetch(new URL('/api/inbound/email', DEFAULT_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [INGEST_SIGNATURE_HEADER]: signature,
      [INGEST_TIMESTAMP_HEADER]: String(timestamp),
      [INGEST_NONCE_HEADER]: nonce,
    },
    body,
  });

  const text = await response.text();
  console.log(response.status, text);
  if (!response.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
