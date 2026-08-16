import { z } from 'zod';

import { EmailAddressSchema } from './primitives.js';

export const NormalizedAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().min(1).max(128),
  contentId: z.string().max(998).nullable(),
  isInline: z.boolean(),
  /** Base64 of attachment bytes for the ingest hop (Phase 2). */
  contentBase64: z.string(),
});
export type NormalizedAttachment = z.infer<typeof NormalizedAttachmentSchema>;

export const NormalizedInboundEmailSchema = z.object({
  envelopeFrom: z.string().min(1).max(320),
  envelopeTo: EmailAddressSchema,
  messageIdHeader: z.string().max(998).nullable(),
  inReplyTo: z.string().max(998).nullable(),
  referencesHeader: z.string().max(4000).nullable(),
  fromAddress: EmailAddressSchema,
  fromName: z.string().max(200).nullable(),
  replyTo: z.string().max(998).nullable(),
  to: z.array(
    z.object({
      address: EmailAddressSchema,
      name: z.string().max(200).nullable(),
    }),
  ),
  cc: z.array(
    z.object({
      address: EmailAddressSchema,
      name: z.string().max(200).nullable(),
    }),
  ),
  subject: z.string().max(998).nullable(),
  date: z.string().datetime(),
  text: z.string().nullable(),
  html: z.string().nullable(),
  fingerprint: z.string().min(1).max(128),
  rawMimeBase64: z.string().min(1),
  rawSizeBytes: z.number().int().nonnegative(),
  attachments: z.array(NormalizedAttachmentSchema),
});
export type NormalizedInboundEmail = z.infer<typeof NormalizedInboundEmailSchema>;

export const IngestRequestSchema = z.object({
  timestamp: z.number().int(),
  nonce: z.string().min(8).max(128),
  email: NormalizedInboundEmailSchema,
});
export type IngestRequest = z.infer<typeof IngestRequestSchema>;
