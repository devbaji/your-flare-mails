import { describe, expect, it } from 'vitest';

import { AuthorizationError, requireMailboxAccess } from './context.js';

function createDb(role: string | null) {
  return {
    prepare(_query: string) {
      return {
        bind(..._values: unknown[]) {
          return {
            async first<T>() {
              return (role ? { role } : null) as T | null;
            },
            async run() {
              return {};
            },
            async all<T>() {
              return { results: [] as T[] };
            },
          };
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

describe('requireMailboxAccess', () => {
  it('allows members', async () => {
    await expect(
      requireMailboxAccess(createDb('owner'), { userId: 'user_1' }, 'mbx_1'),
    ).resolves.toBeUndefined();
  });

  it('rejects non-members', async () => {
    await expect(
      requireMailboxAccess(createDb(null), { userId: 'user_1' }, 'mbx_1'),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
