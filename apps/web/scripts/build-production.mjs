#!/usr/bin/env node
/**
 * Load apps/web/.env.production.local into process.env, then run `nuxt build`.
 * Guarantees NUXT_PUBLIC_API_BASE_URL is set before nuxt.config / the module evaluate.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(webRoot, '.env.production.local');

if (!existsSync(envFile)) {
  console.error('Missing .env.production.local — run: pnpm deploy:configure');
  process.exit(1);
}

for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const i = trimmed.indexOf('=');
  if (i === -1) continue;
  const key = trimmed.slice(0, i).trim();
  const value = trimmed.slice(i + 1).trim();
  if (key) process.env[key] = value;
}

if (!process.env.NUXT_PUBLIC_API_BASE_URL) {
  console.error('.env.production.local must set NUXT_PUBLIC_API_BASE_URL');
  process.exit(1);
}

console.log(`Building with NUXT_PUBLIC_API_BASE_URL=${process.env.NUXT_PUBLIC_API_BASE_URL}`);

const result = spawnSync('nuxt', ['build'], {
  cwd: webRoot,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
