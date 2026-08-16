import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema } from './primitives.js';

/**
 * Realtime mailbox events (ids only — clients refresh via REST).
 */
export const MailboxRealtimeEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.created'),
    mailboxId: IdSchema,
    messageId: IdSchema,
    threadId: IdSchema,
    at: IsoDateTimeSchema,
  }),
  z.object({
    type: z.literal('message.sent'),
    mailboxId: IdSchema,
    messageId: IdSchema,
    threadId: IdSchema,
    at: IsoDateTimeSchema,
  }),
  z.object({
    type: z.literal('mailbox.changed'),
    mailboxId: IdSchema,
    at: IsoDateTimeSchema,
    reason: z.string().max(64).optional(),
  }),
  z.object({
    type: z.literal('ping'),
    at: IsoDateTimeSchema,
  }),
]);

export type MailboxRealtimeEvent = z.infer<typeof MailboxRealtimeEventSchema>;

export const REALTIME_EVENT_CURSOR_HEADER = 'x-yfm-realtime-since' as const;
