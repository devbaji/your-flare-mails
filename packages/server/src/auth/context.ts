import { MailboxRepository, type D1Queryable } from '@your-flare-mails/cloudflare';

/**
 * Authenticated caller context. Every mailbox-scoped service call must receive this.
 * Phase 8 replaces the temporary header-based identity with real sessions / Access.
 */
export type AuthContext = {
  userId: string;
};

export class AuthorizationError extends Error {
  readonly code = 'forbidden';
  constructor(message = 'not authorized for this mailbox') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'not_found';
  constructor(message = 'resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  readonly code = 'validation_error';
  constructor(message = 'invalid request') {
    super(message);
    this.name = 'ValidationError';
  }
}

export async function requireMailboxAccess(
  db: D1Queryable,
  ctx: AuthContext,
  mailboxId: string,
): Promise<void> {
  const repo = new MailboxRepository(db);
  const role = await repo.getUserRole(mailboxId, ctx.userId);
  if (!role) {
    throw new AuthorizationError();
  }
}
