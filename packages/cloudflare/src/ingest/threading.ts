/**
 * Thread resolution helpers (header walk + subject/participant fallback).
 */

/** How far back subject/participant fallback may look. */
export const THREAD_FALLBACK_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;

/**
 * Normalize a subject for fallback matching: lowercase, collapse whitespace,
 * strip repeated Re:/Fwd:/Fw:/Aw:/Wg:/Sv: prefixes (common reply/forward markers).
 */
export function normalizeSubjectForThreading(
  subject: string | null | undefined,
): string {
  if (!subject?.trim()) return '';
  let value = subject.trim().toLowerCase().replace(/\s+/g, ' ');
  let previous = '';
  while (value !== previous) {
    previous = value;
    value = value.replace(/^(re|fw|fwd|aw|wg|sv)\s*:\s*/u, '').trim();
  }
  return value;
}

export function extractMessageIds(header: string | null | undefined): string[] {
  if (!header?.trim()) return [];
  const matches = header.match(/<[^>]+>/g);
  if (matches?.length) {
    return matches.map((m) => m.trim());
  }
  return header
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Collect lowercase addresses that participate in a message. */
export function collectParticipantAddresses(input: {
  fromAddress?: string | null;
  to?: Array<{ address: string }>;
  cc?: Array<{ address: string }>;
  recipientsText?: string | null;
}): Set<string> {
  const out = new Set<string>();
  if (input.fromAddress?.trim()) {
    out.add(input.fromAddress.trim().toLowerCase());
  }
  for (const list of [input.to ?? [], input.cc ?? []]) {
    for (const recipient of list) {
      if (recipient.address?.trim()) {
        out.add(recipient.address.trim().toLowerCase());
      }
    }
  }
  if (input.recipientsText?.trim()) {
    for (const token of input.recipientsText.split(/[\s,;]+/)) {
      const address = token.trim().toLowerCase();
      if (address.includes('@')) out.add(address);
    }
  }
  return out;
}

export function participantsOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const address of a) {
    if (b.has(address)) return true;
  }
  return false;
}

export type ThreadFallbackCandidate = {
  threadId: string;
  subject: string | null;
  fromAddress: string;
  recipientsText: string;
  lastMessageAt: string | null;
};

/**
 * Pick the best recent thread when In-Reply-To / References did not match.
 * Requires a non-empty normalized subject and at least one overlapping participant.
 */
export function matchThreadFallback(input: {
  subject: string | null | undefined;
  fromAddress: string;
  to: Array<{ address: string }>;
  cc: Array<{ address: string }>;
  candidates: ThreadFallbackCandidate[];
  nowMs?: number;
}): string | null {
  const normalized = normalizeSubjectForThreading(input.subject);
  if (!normalized) return null;

  const inbound = collectParticipantAddresses({
    fromAddress: input.fromAddress,
    to: input.to,
    cc: input.cc,
  });
  const now = input.nowMs ?? Date.now();
  const earliest = now - THREAD_FALLBACK_WINDOW_MS;

  for (const candidate of input.candidates) {
    if (normalizeSubjectForThreading(candidate.subject) !== normalized) {
      continue;
    }
    const at = candidate.lastMessageAt
      ? Date.parse(candidate.lastMessageAt)
      : Number.NaN;
    if (Number.isFinite(at) && at < earliest) continue;

    const existing = collectParticipantAddresses({
      fromAddress: candidate.fromAddress,
      recipientsText: candidate.recipientsText,
    });
    if (participantsOverlap(inbound, existing)) {
      return candidate.threadId;
    }
  }

  return null;
}

/**
 * Escape a free-text query for FTS5 MATCH (prefix tokens + phrase-safe).
 * Returns null when the query has no usable tokens.
 */
export function buildFtsMatchQuery(raw: string): string | null {
  const tokens = raw
    .trim()
    .toLowerCase()
    .split(/[\s\u3000]+/u)
    .map((token) => token.replace(/["'^:(){}[\]~*\\]/g, ''))
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token}"*`).join(' AND ');
}
