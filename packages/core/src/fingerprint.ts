/**
 * Deterministic message fingerprint for inbound idempotency.
 *
 * Prefer Message-ID + sorted envelope recipients. When Message-ID is absent
 * or untrustworthy, fall back to a content hash of normalized headers + body.
 *
 * Uses Web Crypto when available (Workers / modern Node); callers may pass a
 * `hash` implementation for tests.
 */

export type FingerprintInput = {
  messageIdHeader?: string | null;
  envelopeRecipients: string[];
  /** Fallback material when Message-ID is missing (e.g. date|from|subject|body). */
  contentMaterial?: string | null;
};

export type HashFn = (data: string) => Promise<string>;

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function normalizeMessageId(messageId: string): string {
  return messageId.trim().toLowerCase().replace(/^<|>$/g, '');
}

async function defaultSha256Hex(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns a stable fingerprint string (hex SHA-256 by default).
 */
export async function computeMessageFingerprint(
  input: FingerprintInput,
  hash: HashFn = defaultSha256Hex,
): Promise<string> {
  const recipients = [...input.envelopeRecipients]
    .map(normalizeAddress)
    .filter(Boolean)
    .sort();

  const messageId = input.messageIdHeader?.trim()
    ? normalizeMessageId(input.messageIdHeader)
    : '';

  if (messageId) {
    return hash(`mid:${messageId}|rcpt:${recipients.join(',')}`);
  }

  const material = (input.contentMaterial ?? '').trim();
  if (!material) {
    throw new Error(
      'computeMessageFingerprint: Message-ID missing and contentMaterial is empty',
    );
  }

  return hash(`content:${material}|rcpt:${recipients.join(',')}`);
}
