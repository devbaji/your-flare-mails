#!/usr/bin/env node
/**
 * Production desktop/mobile SPA build.
 * Loads apps/web/.env.production.local (from `pnpm deploy:configure`) so the
 * APK/IPA talks to the real API instead of 127.0.0.1:8787.
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

process.env.YFM_DESKTOP = '1';

console.log(
  `Building desktop/mobile SPA with NUXT_PUBLIC_API_BASE_URL=${process.env.NUXT_PUBLIC_API_BASE_URL}`,
);

const result = spawnSync('nuxt', ['generate'], {
  cwd: webRoot,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
