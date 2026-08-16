import { describe, expect, it } from 'vitest';

import {
  buildFtsMatchQuery,
  extractMessageIds,
  matchThreadFallback,
  normalizeSubjectForThreading,
  participantsOverlap,
  collectParticipantAddresses,
} from './threading.js';

describe('normalizeSubjectForThreading', () => {
  it('strips repeated reply/forward prefixes', () => {
    expect(normalizeSubjectForThreading('Re: Re: Hello')).toBe('hello');
    expect(normalizeSubjectForThreading('FWD: Fw: Invoice')).toBe('invoice');
    expect(normalizeSubjectForThreading('Aw: WG: Meeting')).toBe('meeting');
  });

  it('returns empty for blank subjects', () => {
    expect(normalizeSubjectForThreading(null)).toBe('');
    expect(normalizeSubjectForThreading('   ')).toBe('');
  });
});

describe('extractMessageIds', () => {
  it('prefers angle-bracket tokens', () => {
    expect(extractMessageIds('<a@x> <b@y>')).toEqual(['<a@x>', '<b@y>']);
  });

  it('falls back to whitespace split', () => {
    expect(extractMessageIds('id-one id-two')).toEqual(['id-one', 'id-two']);
  });
});

describe('matchThreadFallback', () => {
  it('joins on normalized subject + overlapping participant', () => {
    const threadId = matchThreadFallback({
      subject: 'Re: Project update',
      fromAddress: 'alice@example.com',
      to: [{ address: 'hello@example.com' }],
      cc: [],
      candidates: [
        {
          threadId: 'thr_1',
          subject: 'Project update',
          fromAddress: 'hello@example.com',
          recipientsText: 'alice@example.com',
          lastMessageAt: new Date().toISOString(),
        },
      ],
    });
    expect(threadId).toBe('thr_1');
  });

  it('does not match without participant overlap', () => {
    const threadId = matchThreadFallback({
      subject: 'Project update',
      fromAddress: 'stranger@example.com',
      to: [{ address: 'hello@example.com' }],
      cc: [],
      candidates: [
        {
          threadId: 'thr_1',
          subject: 'Project update',
          fromAddress: 'bob@example.com',
          recipientsText: 'carol@example.com',
          lastMessageAt: new Date().toISOString(),
        },
      ],
    });
    expect(threadId).toBeNull();
  });
});

describe('participantsOverlap', () => {
  it('detects shared addresses', () => {
    const a = collectParticipantAddresses({ fromAddress: 'a@x.com' });
    const b = collectParticipantAddresses({ recipientsText: 'a@x.com b@y.com' });
    expect(participantsOverlap(a, b)).toBe(true);
  });
});

describe('buildFtsMatchQuery', () => {
  it('builds prefix AND query', () => {
    expect(buildFtsMatchQuery('Invoice PDF')).toBe('"invoice"* AND "pdf"*');
  });

  it('returns null for empty/noisy input', () => {
    expect(buildFtsMatchQuery('   ')).toBeNull();
    expect(buildFtsMatchQuery('"""')).toBeNull();
  });
});
