import PostalMime from 'postal-mime';

import {
  MAX_ATTACHMENT_BYTES,
  MAX_MESSAGE_BYTES,
  computeMessageFingerprint,
  type NormalizedAttachment,
  type NormalizedInboundEmail,
} from '@your-flare-mails/core';

export type ParseMimeInput = {
  raw: Uint8Array | ArrayBuffer | ReadableStream;
  envelopeFrom: string;
  envelopeTo: string;
  rawSizeBytes?: number;
};

export type ParseMimeResult =
  | { ok: true; email: NormalizedInboundEmail }
  | { ok: false; error: string; reject?: boolean };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function addressOf(value: unknown): { address: string; name: string | null } | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.includes('@')) return null;
    return { address: trimmed.toLowerCase(), name: null };
  }

  const record = asRecord(value);
  if (!record) return null;

  if (typeof record.address === 'string' && record.address.includes('@')) {
    return {
      address: record.address.trim().toLowerCase(),
      name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : null,
    };
  }

  // Group address — flatten nested mailboxes when present.
  if (Array.isArray(record.group)) {
    for (const member of record.group) {
      const nested = addressOf(member);
      if (nested) return nested;
    }
  }

  return null;
}

function listAddresses(value: unknown): Array<{ address: string; name: string | null }> {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => addressOf(item))
    .filter((item): item is { address: string; name: string | null } => item !== null);
}

function headerToString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    const joined = value.map(String).join(' ').trim();
    return joined || null;
  }
  return String(value).trim() || null;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function readRawBytes(
  raw: Uint8Array | ArrayBuffer | ReadableStream,
): Promise<Uint8Array> {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  const reader = raw.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total > MAX_MESSAGE_BYTES) {
        throw new Error(`raw MIME exceeds MAX_MESSAGE_BYTES (${MAX_MESSAGE_BYTES})`);
      }
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function parseDate(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function attachmentBytes(content: unknown): Uint8Array | null {
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (content instanceof Uint8Array) return content;
  if (typeof content === 'string') return new TextEncoder().encode(content);
  return null;
}

/**
 * Parse raw MIME into a normalized inbound email payload.
 * Malformed MIME returns ok:false rather than throwing (unless size caps).
 */
export async function parseMimeToNormalizedEmail(
  input: ParseMimeInput,
): Promise<ParseMimeResult> {
  let rawBytes: Uint8Array;
  try {
    rawBytes = await readRawBytes(input.raw);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'failed to read raw MIME',
      reject: true,
    };
  }

  const rawSize = input.rawSizeBytes ?? rawBytes.byteLength;
  if (rawSize > MAX_MESSAGE_BYTES) {
    return {
      ok: false,
      error: `message too large (${rawSize} > ${MAX_MESSAGE_BYTES})`,
      reject: true,
    };
  }

  let parsed: Awaited<ReturnType<typeof PostalMime.parse>>;
  try {
    parsed = await PostalMime.parse(rawBytes);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'MIME parse failed',
    };
  }

  const from =
    addressOf(parsed.from) ??
    addressOf(input.envelopeFrom) ?? {
      address: 'unknown@invalid.local',
      name: null,
    };

  const to = listAddresses(parsed.to);
  const cc = listAddresses(parsed.cc);
  if (to.length === 0) {
    to.push({ address: input.envelopeTo.toLowerCase(), name: null });
  }

  const attachments: NormalizedAttachment[] = [];
  for (const att of parsed.attachments ?? []) {
    const bytes = attachmentBytes(att.content);
    if (!bytes) continue;

    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        error: `attachment exceeds MAX_ATTACHMENT_BYTES (${MAX_ATTACHMENT_BYTES})`,
        reject: true,
      };
    }

    attachments.push({
      filename: att.filename?.trim() || 'attachment',
      contentType: att.mimeType || 'application/octet-stream',
      sizeBytes: bytes.byteLength,
      checksum: `sha256:${await sha256Hex(bytes)}`,
      contentId: att.contentId ?? null,
      isInline: Boolean(att.related || att.contentId),
      contentBase64: bytesToBase64(bytes),
    });
  }

  const messageIdHeader = headerToString(parsed.messageId);
  const inReplyTo = headerToString(parsed.inReplyTo);
  const referencesHeader = headerToString(parsed.references);
  const text = parsed.text ?? null;
  const html = parsed.html ?? null;
  const subject = parsed.subject ?? null;
  const date = parseDate(parsed.date);

  const fingerprint = await computeMessageFingerprint({
    messageIdHeader,
    envelopeRecipients: [input.envelopeTo],
    contentMaterial: `${date}|${from.address}|${subject ?? ''}|${text ?? ''}|${html ?? ''}`,
  });

  const email: NormalizedInboundEmail = {
    envelopeFrom: input.envelopeFrom,
    envelopeTo: input.envelopeTo.toLowerCase(),
    messageIdHeader,
    inReplyTo,
    referencesHeader,
    fromAddress: from.address,
    fromName: from.name,
    replyTo: listAddresses(parsed.replyTo)[0]?.address ?? null,
    to,
    cc,
    subject,
    date,
    text,
    html,
    fingerprint,
    rawMimeBase64: bytesToBase64(rawBytes),
    rawSizeBytes: rawSize,
    attachments,
  };

  return { ok: true, email };
}
