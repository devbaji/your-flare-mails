import { DevicePlatformSchema } from '@your-flare-mails/core';
import {
  DeviceRepository,
  NotificationSubscriptionRepository,
  type D1Queryable,
  type PushMessage,
  type PushTransport,
} from '@your-flare-mails/cloudflare';

import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  requireMailboxAccess,
  type AuthContext,
} from '../auth/context.js';

export type DeviceServiceDeps = {
  db: D1Queryable;
};

export type NotificationServiceDeps = {
  db: D1Queryable;
  push: PushTransport;
};

export async function registerDevice(
  deps: DeviceServiceDeps,
  ctx: AuthContext,
  input: {
    platform: unknown;
    pushEndpoint: unknown;
    pushKeysJson?: unknown;
    mailboxId?: unknown;
  },
) {
  const platformParsed = DevicePlatformSchema.safeParse(input.platform);
  if (!platformParsed.success) {
    throw new ValidationError('invalid platform');
  }
  if (typeof input.pushEndpoint !== 'string' || !input.pushEndpoint.trim()) {
    throw new ValidationError('pushEndpoint is required');
  }
  const platform = platformParsed.data;
  if (platform === 'desktop') {
    throw new ValidationError('desktop uses local notifications, not remote push registration');
  }

  const nowIso = new Date().toISOString();
  const device = await new DeviceRepository(deps.db).upsert({
    userId: ctx.userId,
    platform,
    pushEndpoint: input.pushEndpoint.trim(),
    pushKeysJson:
      typeof input.pushKeysJson === 'string' ? input.pushKeysJson : null,
    nowIso,
  });

  if (typeof input.mailboxId === 'string' && input.mailboxId) {
    await requireMailboxAccess(deps.db, ctx, input.mailboxId);
    await new NotificationSubscriptionRepository(deps.db).subscribe({
      deviceId: device.id,
      mailboxId: input.mailboxId,
      nowIso,
    });
  }

  return device;
}

export async function unregisterDevice(
  deps: DeviceServiceDeps,
  ctx: AuthContext,
  deviceId: string,
): Promise<void> {
  const device = await new DeviceRepository(deps.db).findById(deviceId);
  if (!device || device.userId !== ctx.userId) {
    throw new NotFoundError('device not found');
  }
  await new DeviceRepository(deps.db).deleteForUser(ctx.userId, deviceId);
}

export async function subscribeDeviceToMailbox(
  deps: DeviceServiceDeps,
  ctx: AuthContext,
  deviceId: string,
  mailboxId: string,
): Promise<void> {
  const device = await new DeviceRepository(deps.db).findById(deviceId);
  if (!device || device.userId !== ctx.userId) {
    throw new NotFoundError('device not found');
  }
  await requireMailboxAccess(deps.db, ctx, mailboxId);
  await new NotificationSubscriptionRepository(deps.db).subscribe({
    deviceId,
    mailboxId,
    nowIso: new Date().toISOString(),
  });
}

/**
 * Fan-out remote push to devices subscribed to a mailbox.
 * Best-effort — never throws to callers.
 */
export async function notifyMailboxDevices(
  deps: NotificationServiceDeps,
  mailboxId: string,
  message: PushMessage,
): Promise<{ attempted: number; delivered: number }> {
  const devices = await new DeviceRepository(deps.db).listForMailbox(mailboxId);
  let delivered = 0;
  for (const device of devices) {
    if (!device.pushEndpoint) continue;
    if (device.platform === 'desktop') continue;
    try {
      const result = await deps.push.sendToDevice({
        platform: device.platform,
        endpoint: device.pushEndpoint,
        keysJson: device.pushKeysJson,
        message,
      });
      if (result.ok) delivered += 1;
      else console.error('[push]', result.error);
    } catch (error) {
      console.error('[push]', error);
    }
  }
  return { attempted: devices.length, delivered };
}

export async function assertDeviceOwned(
  deps: DeviceServiceDeps,
  ctx: AuthContext,
  deviceId: string,
) {
  const device = await new DeviceRepository(deps.db).findById(deviceId);
  if (!device || device.userId !== ctx.userId) {
    throw new AuthorizationError('not authorized for this device');
  }
  return device;
}
