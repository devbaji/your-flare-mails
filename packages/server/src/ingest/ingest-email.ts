import {
  IngestRequestSchema,
  verifyIngestSignature,
  type IngestRequest,
  type MailboxRealtimeEvent,
} from '@your-flare-mails/core';
import {
  D1IngestRepository,
  R2BlobStore,
  base64ToBytes,
  newId,
  splitBodyForStorage,
  type D1Queryable,
  type R2Puttable,
} from '@your-flare-mails/cloudflare';

export type IngestEmailDeps = {
  db: D1Queryable;
  r2: R2Puttable;
  hmacSecret: string;
  /** Best-effort realtime fan-out (Phase 7). Must not throw into ingest. */
  notifyMailbox?: (event: MailboxRealtimeEvent) => Promise<void>;
};

export type IngestEmailHttpInput = {
  rawBody: string;
  signatureHex: string;
  timestampSeconds: number;
  nonce: string;
};

export type IngestEmailResult =
  | {
      status: 'created';
      messageId: string;
      threadId: string;
      mailboxId: string;
    }
  | {
      status: 'duplicate';
      messageId: string;
      threadId: string;
      mailboxId: string;
    }
  | {
      status: 'rejected';
      httpStatus: number;
      code: string;
      message: string;
    };

/**
 * Authenticated inbound email ingestion (Worker → backend).
 * Business logic lives here; HTTP handlers stay thin.
 */
export async function ingestEmail(
  deps: IngestEmailDeps,
  input: IngestEmailHttpInput,
): Promise<IngestEmailResult> {
  const verified = await verifyIngestSignature({
    secret: deps.hmacSecret,
    body: input.rawBody,
    signatureHex: input.signatureHex,
    timestampSeconds: input.timestampSeconds,
  });

  if (!verified.ok) {
    return {
      status: 'rejected',
      httpStatus: 401,
      code: verified.reason,
      message: 'invalid ingestion signature',
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody);
  } catch {
    return {
      status: 'rejected',
      httpStatus: 400,
      code: 'invalid_json',
      message: 'body must be JSON',
    };
  }

  const requestResult = IngestRequestSchema.safeParse(parsedJson);
  if (!requestResult.success) {
    return {
      status: 'rejected',
      httpStatus: 400,
      code: 'invalid_payload',
      message: 'ingest payload failed validation',
    };
  }

  const request: IngestRequest = requestResult.data;
  if (request.nonce !== input.nonce || request.timestamp !== input.timestampSeconds) {
    return {
      status: 'rejected',
      httpStatus: 401,
      code: 'header_mismatch',
      message: 'nonce/timestamp headers must match body',
    };
  }

  const repo = new D1IngestRepository(deps.db);
  const blobs = new R2BlobStore(deps.r2);
  const nowIso = new Date().toISOString();

  if (await repo.hasNonce(request.nonce)) {
    const existing = await repo.findMessageByFingerprint(request.email.fingerprint);
    if (existing) {
      const mailbox = await repo.findMailboxByAddress(request.email.envelopeTo);
      return {
        status: 'duplicate',
        messageId: existing.id,
        threadId: existing.threadId,
        mailboxId: mailbox?.id ?? '',
      };
    }
    return {
      status: 'rejected',
      httpStatus: 409,
      code: 'replay',
      message: 'nonce already used',
    };
  }

  const mailbox = await repo.findMailboxByAddress(request.email.envelopeTo);
  if (!mailbox) {
    return {
      status: 'rejected',
      httpStatus: 404,
      code: 'unknown_mailbox',
      message: `no mailbox for ${request.email.envelopeTo}`,
    };
  }

  const existingByFingerprint = await repo.findMessageByFingerprint(
    request.email.fingerprint,
  );
  if (existingByFingerprint) {
    await repo.recordNonce(request.nonce, request.email.fingerprint, nowIso);
    return {
      status: 'duplicate',
      messageId: existingByFingerprint.id,
      threadId: existingByFingerprint.threadId,
      mailboxId: mailbox.id,
    };
  }

  const { threadId } = await repo.resolveThreadId(mailbox.id, request.email);
  const messageId = newId('msg');
  const rawMimeR2Key = `mailboxes/${mailbox.id}/raw/${messageId}.eml`;
  const { bodyText, bodyTextR2KeyNeeded } = splitBodyForStorage(request.email.text);
  const bodyTextR2Key = bodyTextR2KeyNeeded
    ? `mailboxes/${mailbox.id}/bodies/${messageId}.txt`
    : null;
  const bodyHtmlR2Key = request.email.html
    ? `mailboxes/${mailbox.id}/bodies/${messageId}.html`
    : null;

  await blobs.putBytes(
    rawMimeR2Key,
    base64ToBytes(request.email.rawMimeBase64),
    'message/rfc822',
  );

  if (bodyTextR2Key && request.email.text) {
    await blobs.putBytes(
      bodyTextR2Key,
      new TextEncoder().encode(request.email.text),
      'text/plain; charset=utf-8',
    );
  }
  if (bodyHtmlR2Key && request.email.html) {
    await blobs.putBytes(
      bodyHtmlR2Key,
      new TextEncoder().encode(request.email.html),
      'text/html; charset=utf-8',
    );
  }

  const attachmentKeys = [];
  for (const [index, attachment] of request.email.attachments.entries()) {
    const r2Key = `mailboxes/${mailbox.id}/attachments/${messageId}/${index}-${attachment.filename}`;
    await blobs.putBytes(
      r2Key,
      base64ToBytes(attachment.contentBase64),
      attachment.contentType,
    );
    attachmentKeys.push({ attachment, r2Key });
  }

  const labelInboxId = await repo.findInboxLabelId(mailbox.id);

  try {
    await repo.persistInbound({
      mailboxId: mailbox.id,
      threadId,
      email: request.email,
      rawMimeR2Key,
      bodyText,
      bodyTextR2Key,
      bodyHtmlR2Key,
      attachmentKeys,
      nowIso,
      messageId,
      labelInboxId,
    });
    await repo.recordNonce(request.nonce, request.email.fingerprint, nowIso);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'persist failed';
    if (/UNIQUE|unique|fingerprint/i.test(message)) {
      const raced = await repo.findMessageByFingerprint(request.email.fingerprint);
      if (raced) {
        return {
          status: 'duplicate',
          messageId: raced.id,
          threadId: raced.threadId,
          mailboxId: mailbox.id,
        };
      }
    }
    throw error;
  }

  if (deps.notifyMailbox) {
    try {
      await deps.notifyMailbox({
        type: 'message.created',
        mailboxId: mailbox.id,
        messageId,
        threadId,
        at: nowIso,
      });
    } catch {
      // Realtime is best-effort; persistence already succeeded.
    }
  }

  return {
    status: 'created',
    messageId,
    threadId,
    mailboxId: mailbox.id,
  };
}
