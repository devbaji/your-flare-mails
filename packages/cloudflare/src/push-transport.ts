/**
 * Remote push transports for APNs / FCM / Web Push.
 * Workers-compatible (fetch + Web Crypto). No Node-only deps.
 */

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type PushSendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: string };

export type PushTransport = {
  sendToDevice(input: {
    platform: 'ios' | 'android' | 'web' | 'desktop';
    endpoint: string;
    keysJson?: string | null;
    message: PushMessage;
  }): Promise<PushSendResult>;
};

/** Logs pushes locally — used when APNs/FCM credentials are not configured. */
export class MockPushTransport implements PushTransport {
  readonly sent: Array<{
    platform: string;
    endpoint: string;
    message: PushMessage;
  }> = [];

  async sendToDevice(input: {
    platform: 'ios' | 'android' | 'web' | 'desktop';
    endpoint: string;
    keysJson?: string | null;
    message: PushMessage;
  }): Promise<PushSendResult> {
    this.sent.push({
      platform: input.platform,
      endpoint: input.endpoint,
      message: input.message,
    });
    console.log('[MockPushTransport]', {
      platform: input.platform,
      endpoint: `${input.endpoint.slice(0, 12)}…`,
      title: input.message.title,
    });
    return { ok: true, providerMessageId: `mock-push-${this.sent.length}` };
  }
}

export type ApnsConfig = {
  teamId: string;
  keyId: string;
  /** PKCS8 PEM contents for the .p8 key (BEGIN PRIVATE KEY). */
  privateKeyPem: string;
  bundleId: string;
  /** Use sandbox APNs host in development. */
  production?: boolean;
};

export type FcmConfig = {
  /** Full Google service-account JSON string. */
  serviceAccountJson: string;
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64Url(data: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    bytes = new Uint8Array(data);
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signApnsJwt(config: ApnsConfig): Promise<string> {
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(JSON.stringify({ iss: config.teamId, iat: now }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(config.privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    data,
  );
  // WebCrypto returns IEEE P1363; APNs expects DER... Actually APNs JWT uses
  // ES256 which is R||S (P1363) in JOSE — WebCrypto gives P1363. Good.
  return `${header}.${payload}.${base64Url(signature)}`;
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
    token_uri?: string;
  };
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const assertion = `${header}.${claim}.${base64Url(signature)}`;
  const tokenUrl = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`FCM token exchange failed (${response.status})`);
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('FCM token missing');
  return body.access_token;
}

/**
 * Composite transport: APNs for iOS, FCM for Android, mock/no-op otherwise.
 */
export class CloudflarePushTransport implements PushTransport {
  constructor(
    private readonly options: {
      apns?: ApnsConfig;
      fcm?: FcmConfig;
      fallback?: PushTransport;
    },
  ) {}

  async sendToDevice(input: {
    platform: 'ios' | 'android' | 'web' | 'desktop';
    endpoint: string;
    keysJson?: string | null;
    message: PushMessage;
  }): Promise<PushSendResult> {
    try {
      if (input.platform === 'ios') {
        if (!this.options.apns) {
          return this.fallback(input);
        }
        return await this.sendApns(input.endpoint, input.message);
      }
      if (input.platform === 'android') {
        if (!this.options.fcm) {
          return this.fallback(input);
        }
        return await this.sendFcm(input.endpoint, input.message);
      }
      // web/desktop remote push not configured in Phase 10 (desktop uses local toasts).
      return this.fallback(input);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'push failed',
      };
    }
  }

  private async fallback(input: {
    platform: 'ios' | 'android' | 'web' | 'desktop';
    endpoint: string;
    keysJson?: string | null;
    message: PushMessage;
  }): Promise<PushSendResult> {
    if (this.options.fallback) {
      return this.options.fallback.sendToDevice(input);
    }
    return { ok: false, error: `no push transport for ${input.platform}` };
  }

  private async sendApns(deviceToken: string, message: PushMessage): Promise<PushSendResult> {
    const config = this.options.apns!;
    const host = config.production
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';
    const jwt = await signApnsJwt(config);
    const response = await fetch(`${host}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': config.bundleId,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        aps: {
          alert: { title: message.title, body: message.body },
          sound: 'default',
        },
        ...(message.data ?? {}),
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `APNs ${response.status}: ${text.slice(0, 200)}` };
    }
    const apnsId = response.headers.get('apns-id');
    return apnsId ? { ok: true, providerMessageId: apnsId } : { ok: true };
  }

  private async sendFcm(token: string, message: PushMessage): Promise<PushSendResult> {
    const config = this.options.fcm!;
    const sa = JSON.parse(config.serviceAccountJson) as { project_id: string };
    const accessToken = await getGoogleAccessToken(config.serviceAccountJson);
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: message.title,
              body: message.body,
            },
            data: message.data ?? {},
          },
        }),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `FCM ${response.status}: ${text.slice(0, 200)}` };
    }
    const body = (await response.json()) as { name?: string };
    return body.name ? { ok: true, providerMessageId: body.name } : { ok: true };
  }
}
