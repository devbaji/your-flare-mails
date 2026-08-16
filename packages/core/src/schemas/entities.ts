import { z } from 'zod';

import {
  DevicePlatformSchema,
  EmailAddressSchema,
  IdSchema,
  IsoDateTimeSchema,
  MailboxUserRoleSchema,
  MessageDirectionSchema,
  MessageStatusSchema,
  RecipientTypeSchema,
  SettingsScopeSchema,
} from './primitives.js';

export const UserSchema = z.object({
  id: IdSchema,
  email: EmailAddressSchema,
  displayName: z.string().max(200).nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type User = z.infer<typeof UserSchema>;

export const DomainSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(253),
  zoneId: z.string().max(64).nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Domain = z.infer<typeof DomainSchema>;

export const MailboxSchema = z.object({
  id: IdSchema,
  domainId: IdSchema,
  localPart: z.string().min(1).max(64),
  address: EmailAddressSchema,
  displayName: z.string().max(200).nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Mailbox = z.infer<typeof MailboxSchema>;

export const MailboxUserSchema = z.object({
  mailboxId: IdSchema,
  userId: IdSchema,
  role: MailboxUserRoleSchema,
  createdAt: IsoDateTimeSchema,
});
export type MailboxUser = z.infer<typeof MailboxUserSchema>;

export const ThreadSchema = z.object({
  id: IdSchema,
  mailboxId: IdSchema,
  subject: z.string().max(998).nullable(),
  snippet: z.string().max(500).nullable(),
  lastMessageAt: IsoDateTimeSchema.nullable(),
  messageCount: z.number().int().nonnegative(),
  isUnread: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Thread = z.infer<typeof ThreadSchema>;

export const MessageSchema = z.object({
  id: IdSchema,
  mailboxId: IdSchema,
  threadId: IdSchema,
  fingerprint: z.string().min(1).max(128),
  messageIdHeader: z.string().max(998).nullable(),
  inReplyTo: z.string().max(998).nullable(),
  referencesHeader: z.string().max(4000).nullable(),
  direction: MessageDirectionSchema,
  status: MessageStatusSchema,
  fromAddress: EmailAddressSchema,
  fromName: z.string().max(200).nullable(),
  replyTo: z.string().max(998).nullable(),
  subject: z.string().max(998).nullable(),
  date: IsoDateTimeSchema,
  /** Small plain-text bodies stored inline; larger bodies use bodyTextR2Key. */
  bodyText: z.string().nullable(),
  bodyTextR2Key: z.string().max(512).nullable(),
  bodyHtmlR2Key: z.string().max(512).nullable(),
  rawMimeR2Key: z.string().max(512).nullable(),
  /** Denormalized recipient string for FTS indexing. */
  recipientsText: z.string().max(4000),
  hasAttachments: z.boolean(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Message = z.infer<typeof MessageSchema>;

export const MessageRecipientSchema = z.object({
  id: IdSchema,
  messageId: IdSchema,
  type: RecipientTypeSchema,
  address: EmailAddressSchema,
  name: z.string().max(200).nullable(),
});
export type MessageRecipient = z.infer<typeof MessageRecipientSchema>;

export const AttachmentSchema = z.object({
  id: IdSchema,
  messageId: IdSchema,
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().min(1).max(128),
  r2Key: z.string().min(1).max(512),
  contentId: z.string().max(998).nullable(),
  isInline: z.boolean(),
  createdAt: IsoDateTimeSchema,
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const LabelSchema = z.object({
  id: IdSchema,
  mailboxId: IdSchema,
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  isSystem: z.boolean(),
  color: z.string().max(32).nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Label = z.infer<typeof LabelSchema>;

export const ThreadLabelSchema = z.object({
  threadId: IdSchema,
  labelId: IdSchema,
  createdAt: IsoDateTimeSchema,
});
export type ThreadLabel = z.infer<typeof ThreadLabelSchema>;

export const MessageLabelSchema = z.object({
  messageId: IdSchema,
  labelId: IdSchema,
  createdAt: IsoDateTimeSchema,
});
export type MessageLabel = z.infer<typeof MessageLabelSchema>;

export const DraftSchema = z.object({
  id: IdSchema,
  mailboxId: IdSchema,
  threadId: IdSchema.nullable(),
  toJson: z.string(),
  ccJson: z.string(),
  bccJson: z.string(),
  subject: z.string().max(998).nullable(),
  bodyText: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  inReplyToMessageId: IdSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Draft = z.infer<typeof DraftSchema>;

export const ContactSchema = z.object({
  id: IdSchema,
  mailboxId: IdSchema,
  email: EmailAddressSchema,
  name: z.string().max(200).nullable(),
  notes: z.string().max(2000).nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Contact = z.infer<typeof ContactSchema>;

export const DeviceSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  platform: DevicePlatformSchema,
  pushEndpoint: z.string().max(2048).nullable(),
  pushKeysJson: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Device = z.infer<typeof DeviceSchema>;

export const NotificationSubscriptionSchema = z.object({
  id: IdSchema,
  deviceId: IdSchema,
  mailboxId: IdSchema,
  createdAt: IsoDateTimeSchema,
});
export type NotificationSubscription = z.infer<typeof NotificationSubscriptionSchema>;

export const SettingSchema = z.object({
  id: IdSchema,
  scope: SettingsScopeSchema,
  scopeId: IdSchema,
  key: z.string().min(1).max(128),
  valueJson: z.string(),
  updatedAt: IsoDateTimeSchema,
});
export type Setting = z.infer<typeof SettingSchema>;
