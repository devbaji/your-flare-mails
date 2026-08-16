#!/usr/bin/env node
/**
 * Hash a password for production seed SQL (PBKDF2, Workers-safe ≤100k iterations).
 * Usage: pnpm run hash-password -- 'your-password'
 */
import { hashPassword } from '@your-flare-mails/core';

const password = process.argv.find((a, i) => i >= 2 && a !== '--');
if (!password) {
  console.error('Usage: pnpm run hash-password -- \'your-password\'');
  process.exit(1);
}

const encoded = await hashPassword(password);
console.log(encoded);
