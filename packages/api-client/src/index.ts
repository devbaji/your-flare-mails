/**
 * Typed HTTP client for YourFlareMails mailbox APIs.
 */

export const PACKAGE_NAME = '@your-flare-mails/api-client' as const;
export type PackageName = typeof PACKAGE_NAME;

export type MailboxDto = {
  id: string;
  domainId: string;
  localPart: string;
  address: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ThreadDto = {
  id: string;
  mailboxId: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  isUnread: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MessageDto = {
  id: string;
  mailboxId: string;
  threadId: string;
  fingerprint: string;
  messageIdHeader: string | null;
  inReplyTo: string | null;
  referencesHeader: string | null;
  direction: 'inbound' | 'outbound';
  status: string;
  fromAddress: string;
  fromName: string | null;
  replyTo: string | null;
  subject: string | null;
  date: string;
  bodyText: string | null;
  bodyTextR2Key: string | null;
  bodyHtmlR2Key: string | null;
  rawMimeR2Key: string | null;
  recipientsText: string;
  hasAttachments: boolean;
  sizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageDetailDto = {
  message: MessageDto;
  recipients: Array<{
    id: string;
    messageId: string;
    type: 'to' | 'cc' | 'bcc';
    address: string;
    name: string | null;
  }>;
  attachments: Array<{
    id: string;
    messageId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    checksum: string;
    r2Key: string;
    contentId: string | null;
    isInline: boolean;
    createdAt: string;
  }>;
  bodyText: string | null;
};

export type MailApiClientOptions = {
  baseUrl: string;
  /** Temporary Phase 3/4 identity until Phase 8 sessions. */
  getUserId: () => string | null | undefined;
  fetch?: typeof fetch;
};

export class MailApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'MailApiError';
  }
}

export function createMailApiClient(options: MailApiClientOptions) {
  const fetchImpl = options.fetch ?? fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const userId = options.getUserId();
    const headers = new Headers(init?.headers);
    headers.set('accept', 'application/json');
    if (userId) headers.set('x-yfm-user-id', userId);

    const response = await fetchImpl(new URL(path, options.baseUrl), {
      ...init,
      headers,
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new MailApiError(
        typeof data === 'object' && data && 'message' in data
          ? String((data as { message: unknown }).message)
          : `Request failed (${response.status})`,
        response.status,
        data,
      );
    }

    return data as T;
  }

  return {
    listMailboxes: () => request<{ mailboxes: MailboxDto[] }>('/api/mailboxes'),
    getMailbox: (id: string) =>
      request<{ mailbox: MailboxDto }>(`/api/mailboxes/${encodeURIComponent(id)}`),
    listThreads: (
      mailboxId: string,
      query: { label?: string | null; before?: string | null; limit?: number } = {},
    ) => {
      const params = new URLSearchParams();
      if (query.label) params.set('label', query.label);
      if (query.before) params.set('before', query.before);
      if (query.limit) params.set('limit', String(query.limit));
      const qs = params.toString();
      return request<{ threads: ThreadDto[] }>(
        `/api/mailboxes/${encodeURIComponent(mailboxId)}/threads${qs ? `?${qs}` : ''}`,
      );
    },
    getThread: (id: string) =>
      request<{ thread: ThreadDto }>(`/api/threads/${encodeURIComponent(id)}`),
    listThreadMessages: (id: string) =>
      request<{ messages: MessageDto[] }>(
        `/api/threads/${encodeURIComponent(id)}/messages`,
      ),
    getMessage: (id: string) =>
      request<MessageDetailDto>(`/api/messages/${encodeURIComponent(id)}`),
  };
}

export type MailApiClient = ReturnType<typeof createMailApiClient>;
