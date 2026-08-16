/**
 * Shared TypeScript types for YourFlareMails.
 * Entity types are defined via Zod in `@your-flare-mails/core` and re-exported here
 * for consumers that want types without pulling schema helpers into every import path.
 */

export const PACKAGE_NAME = '@your-flare-mails/types' as const;
export type PackageName = typeof PACKAGE_NAME;

export type {
  Attachment,
  Contact,
  Device,
  Domain,
  Draft,
  Label,
  Mailbox,
  MailboxUser,
  MailboxUserRole,
  Message,
  MessageDirection,
  MessageLabel,
  MessageRecipient,
  MessageStatus,
  NotificationSubscription,
  OutboundAddress,
  OutboundMail,
  RecipientType,
  SendResult,
  Setting,
  SettingsScope,
  SystemLabelSlug,
  Thread,
  ThreadLabel,
  User,
  DevicePlatform,
} from '@your-flare-mails/core';
