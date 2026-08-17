#!/usr/bin/env node
/**
 * Load deploy brand/API env, sync native labels, then run a desktop command.
 * Usage: node ./scripts/with-brand-env.mjs tauri android build --apk --target aarch64
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadDeployEnv,
  resolveBrandName,
  syncBrandName,
} from '../../../infra/scripts/sync-brand-name.mjs';

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(desktopRoot, '../..');
const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: with-brand-env.mjs <command> [args…]');
  process.exit(1);
}

const deployEnv = loadDeployEnv();
for (const [key, value] of Object.entries(deployEnv)) {
  if (process.env[key] == null) process.env[key] = value;
}

const prodEnvPath = join(root, 'apps/web/.env.production.local');
if (existsSync(prodEnvPath)) {
  for (const line of readFileSync(prodEnvPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

const brandName = resolveBrandName(deployEnv);
process.env.YFM_BRAND_NAME = brandName;
process.env.NUXT_PUBLIC_YFM_BRAND_NAME = brandName;
syncBrandName(brandName);

const [cmd, ...cmdArgs] = args;
const result = spawnSync(cmd, cmdArgs, {
  cwd: desktopRoot,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
process.exit(result.status ?? 1);
