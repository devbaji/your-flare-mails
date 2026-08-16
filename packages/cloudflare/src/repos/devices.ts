import type { DevicePlatform } from '@your-flare-mails/core';

import type { D1Queryable } from '../db.js';
import { newId } from '../ingest/repository.js';

export type DeviceRecord = {
  id: string;
  userId: string;
  platform: DevicePlatform;
  pushEndpoint: string | null;
  pushKeysJson: string | null;
  createdAt: string;
  updatedAt: string;
};

type DeviceRow = {
  id: string;
  user_id: string;
  platform: string;
  push_endpoint: string | null;
  push_keys_json: string | null;
  created_at: string;
  updated_at: string;
};

function mapDevice(row: DeviceRow): DeviceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform as DevicePlatform,
    pushEndpoint: row.push_endpoint,
    pushKeysJson: row.push_keys_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DeviceRepository {
  constructor(private readonly db: D1Queryable) {}

  async upsert(input: {
    userId: string;
    platform: DevicePlatform;
    pushEndpoint: string;
    pushKeysJson?: string | null;
    nowIso: string;
  }): Promise<DeviceRecord> {
    const existing = await this.db
      .prepare(
        `SELECT id, user_id, platform, push_endpoint, push_keys_json, created_at, updated_at
         FROM devices
         WHERE user_id = ? AND platform = ? AND push_endpoint = ?`,
      )
      .bind(input.userId, input.platform, input.pushEndpoint)
      .first<DeviceRow>();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE devices
           SET push_keys_json = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(input.pushKeysJson ?? null, input.nowIso, existing.id)
        .run();
      return mapDevice({
        ...existing,
        push_keys_json: input.pushKeysJson ?? null,
        updated_at: input.nowIso,
      });
    }

    const id = newId('dev');
    await this.db
      .prepare(
        `INSERT INTO devices (
           id, user_id, platform, push_endpoint, push_keys_json, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.userId,
        input.platform,
        input.pushEndpoint,
        input.pushKeysJson ?? null,
        input.nowIso,
        input.nowIso,
      )
      .run();

    return {
      id,
      userId: input.userId,
      platform: input.platform,
      pushEndpoint: input.pushEndpoint,
      pushKeysJson: input.pushKeysJson ?? null,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    };
  }

  async findById(id: string): Promise<DeviceRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, platform, push_endpoint, push_keys_json, created_at, updated_at
         FROM devices WHERE id = ?`,
      )
      .bind(id)
      .first<DeviceRow>();
    return row ? mapDevice(row) : null;
  }

  async deleteForUser(userId: string, deviceId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM devices WHERE id = ? AND user_id = ?`)
      .bind(deviceId, userId)
      .run();
  }

  async listForMailbox(mailboxId: string): Promise<DeviceRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT d.id, d.user_id, d.platform, d.push_endpoint, d.push_keys_json,
                d.created_at, d.updated_at
         FROM devices d
         INNER JOIN notification_subscriptions ns ON ns.device_id = d.id
         WHERE ns.mailbox_id = ?
           AND d.push_endpoint IS NOT NULL
           AND length(d.push_endpoint) > 0`,
      )
      .bind(mailboxId)
      .all<DeviceRow>();
    return (result.results ?? []).map(mapDevice);
  }
}

export class NotificationSubscriptionRepository {
  constructor(private readonly db: D1Queryable) {}

  async subscribe(input: {
    deviceId: string;
    mailboxId: string;
    nowIso: string;
  }): Promise<void> {
    const id = newId('nsub');
    await this.db
      .prepare(
        `INSERT INTO notification_subscriptions (id, device_id, mailbox_id, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(device_id, mailbox_id) DO NOTHING`,
      )
      .bind(id, input.deviceId, input.mailboxId, input.nowIso)
      .run();
  }

  async unsubscribe(deviceId: string, mailboxId: string): Promise<void> {
    await this.db
      .prepare(
        `DELETE FROM notification_subscriptions
         WHERE device_id = ? AND mailbox_id = ?`,
      )
      .bind(deviceId, mailboxId)
      .run();
  }
}
