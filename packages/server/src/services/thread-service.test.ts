import { describe, expect, it } from 'vitest';

import { ThreadRepository } from '@your-flare-mails/cloudflare';

import {
  applyThreadFolderAction,
  archiveThread,
} from './thread-service.js';

type Stmt = {
  run: () => Promise<unknown>;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
};

function createFolderDb(opts: {
  role: string | null;
  mailboxId: string;
  threadId: string;
  initialLabelIds: string[];
}) {
  const labelBySlug: Record<string, string> = {
    inbox: 'lbl_inbox',
    archive: 'lbl_archive',
    trash: 'lbl_trash',
  };
  const threadLabelIds = new Set(opts.initialLabelIds);
  const thread = {
    id: opts.threadId,
    mailbox_id: opts.mailboxId,
    subject: 'Hello',
    snippet: 'Hi',
    last_message_at: '2026-01-01T00:00:00.000Z',
    message_count: 1,
    is_unread: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  function makeStmt(query: string, values: unknown[]): Stmt {
    return {
      async first<T>() {
        if (query.includes('mailbox_members') || query.includes('FROM mailbox')) {
          return (opts.role ? { role: opts.role } : null) as T | null;
        }
        if (query.includes('FROM threads WHERE id')) {
          return thread as T;
        }
        if (query.includes('FROM labels WHERE mailbox_id')) {
          const slug = String(values[1]);
          const id = labelBySlug[slug];
          return (id ? { id } : null) as T | null;
        }
        // getUserRole often selects role only
        if (query.includes('role') && values.length >= 2) {
          return (opts.role ? { role: opts.role } : null) as T | null;
        }
        return null as T | null;
      },
      async all<T>() {
        return { results: [] as T[] };
      },
      async run() {
        if (query.includes('DELETE FROM thread_labels')) {
          threadLabelIds.delete(String(values[1]));
        }
        if (query.includes('INSERT OR IGNORE INTO thread_labels')) {
          threadLabelIds.add(String(values[1]));
        }
        if (query.includes('UPDATE threads SET updated_at')) {
          thread.updated_at = String(values[0]);
        }
        return {};
      },
    };
  }

  const db = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return makeStmt(query, values);
        },
      };
    },
    async batch(stmts: Stmt[]) {
      for (const stmt of stmts) {
        await stmt.run();
      }
      return [];
    },
  };

  return { db, threadLabelIds };
}

describe('ThreadRepository.moveSystemLabels', () => {
  it('removes inbox and adds archive', async () => {
    const { db, threadLabelIds } = createFolderDb({
      role: 'owner',
      mailboxId: 'mbx_1',
      threadId: 'thr_1',
      initialLabelIds: ['lbl_inbox'],
    });

    await new ThreadRepository(db).moveSystemLabels(
      'mbx_1',
      'thr_1',
      ['inbox'],
      'archive',
      '2026-02-01T00:00:00.000Z',
    );

    expect([...threadLabelIds].sort()).toEqual(['lbl_archive']);
  });

  it('trashes by clearing inbox and archive', async () => {
    const { db, threadLabelIds } = createFolderDb({
      role: 'owner',
      mailboxId: 'mbx_1',
      threadId: 'thr_1',
      initialLabelIds: ['lbl_inbox', 'lbl_archive'],
    });

    await new ThreadRepository(db).moveSystemLabels(
      'mbx_1',
      'thr_1',
      ['inbox', 'archive'],
      'trash',
      '2026-02-01T00:00:00.000Z',
    );

    expect([...threadLabelIds]).toEqual(['lbl_trash']);
  });
});

describe('thread folder service', () => {
  it('archives when member', async () => {
    const { db, threadLabelIds } = createFolderDb({
      role: 'owner',
      mailboxId: 'mbx_1',
      threadId: 'thr_1',
      initialLabelIds: ['lbl_inbox'],
    });

    const thread = await archiveThread({ db }, { userId: 'user_1' }, 'thr_1');
    expect(thread.id).toBe('thr_1');
    expect([...threadLabelIds]).toEqual(['lbl_archive']);
  });

  it('applyThreadFolderAction dispatches trash', async () => {
    const { db, threadLabelIds } = createFolderDb({
      role: 'owner',
      mailboxId: 'mbx_1',
      threadId: 'thr_1',
      initialLabelIds: ['lbl_inbox'],
    });

    await applyThreadFolderAction(
      { db },
      { userId: 'user_1' },
      'thr_1',
      'trash',
    );
    expect([...threadLabelIds]).toEqual(['lbl_trash']);
  });

  it('rejects non-members', async () => {
    const { db } = createFolderDb({
      role: null,
      mailboxId: 'mbx_1',
      threadId: 'thr_1',
      initialLabelIds: ['lbl_inbox'],
    });

    await expect(
      archiveThread({ db }, { userId: 'user_x' }, 'thr_1'),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});
