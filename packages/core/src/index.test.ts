import { describe, expect, it } from 'vitest';

import {
  BODY_INLINE_MAX_BYTES,
  MailboxSchema,
  MessageSchema,
  MockMailTransport,
  PACKAGE_NAME,
  SYSTEM_LABEL_SLUGS,
  computeMessageFingerprint,
} from './index.js';

describe('@your-flare-mails/core', () => {
  it('exports a stable package name', () => {
    expect(PACKAGE_NAME).toBe('@your-flare-mails/core');
  });

  it('defines an inline body size threshold', () => {
    expect(BODY_INLINE_MAX_BYTES).toBe(8 * 1024);
  });

  it('lists system labels', () => {
    expect(SYSTEM_LABEL_SLUGS).toContain('inbox');
    expect(SYSTEM_LABEL_SLUGS).toContain('sent');
  });
});

describe('MailboxSchema', () => {
  it('accepts a valid mailbox', () => {
    const mailbox = MailboxSchema.parse({
      id: 'mbx_01',
      domainId: 'dom_01',
      localPart: 'hello',
      address: 'hello@example.com',
      displayName: 'Hello',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(mailbox.address).toBe('hello@example.com');
  });

  it('rejects an invalid address', () => {
    expect(() =>
      MailboxSchema.parse({
        id: 'mbx_01',
        domainId: 'dom_01',
        localPart: 'hello',
        address: 'not-an-email',
        displayName: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('MessageSchema', () => {
  it('requires a fingerprint', () => {
    expect(() =>
      MessageSchema.parse({
        id: 'msg_01',
        mailboxId: 'mbx_01',
        threadId: 'thr_01',
        fingerprint: '',
        messageIdHeader: null,
        inReplyTo: null,
        referencesHeader: null,
        direction: 'inbound',
        status: 'received',
        fromAddress: 'alice@example.com',
        fromName: null,
        replyTo: null,
        subject: 'Hi',
        date: '2026-01-01T00:00:00.000Z',
        bodyText: 'Hello',
        bodyTextR2Key: null,
        bodyHtmlR2Key: null,
        rawMimeR2Key: null,
        recipientsText: 'hello@example.com',
        hasAttachments: false,
        sizeBytes: 10,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('computeMessageFingerprint', () => {
  it('is stable for the same Message-ID and recipients', async () => {
    const a = await computeMessageFingerprint({
      messageIdHeader: '<abc@example.com>',
      envelopeRecipients: ['hello@example.com', 'cc@example.com'],
    });
    const b = await computeMessageFingerprint({
      messageIdHeader: '<ABC@example.com>',
      envelopeRecipients: ['cc@example.com', 'hello@example.com'],
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('falls back to content material when Message-ID is absent', async () => {
    const fp = await computeMessageFingerprint({
      messageIdHeader: null,
      envelopeRecipients: ['hello@example.com'],
      contentMaterial: '2026-01-01|alice@example.com|Hi|body',
    });
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('throws when neither Message-ID nor content material is available', async () => {
    await expect(
      computeMessageFingerprint({
        messageIdHeader: '  ',
        envelopeRecipients: ['hello@example.com'],
      }),
    ).rejects.toThrow(/contentMaterial/);
  });
});

describe('MockMailTransport', () => {
  it('records sends without network I/O', async () => {
    const transport = new MockMailTransport();
    const result = await transport.send({
      from: { address: 'hello@example.com' },
      to: [{ address: 'alice@example.com' }],
      subject: 'Test',
      text: 'Hello',
    });
    expect(result.ok).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.subject).toBe('Test');
  });

  it('can simulate failures', async () => {
    const transport = new MockMailTransport({ fail: true });
    const result = await transport.send({
      from: { address: 'hello@example.com' },
      to: [{ address: 'alice@example.com' }],
      subject: 'Test',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
