#!/usr/bin/env node
/**
 * Put seed attachment bytes into local R2 so Phase 5 download smoke tests work.
 * Local wrangler dev uses preview_bucket_name when present.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, '../fixtures/attachments/invoice-1042.pdf');
const key = 'seed/attachments/invoice-1042.pdf';
const buckets = [
  'your-flare-mails-attachments',
  'your-flare-mails-attachments-preview',
];

for (const bucket of buckets) {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'r2',
      'object',
      'put',
      `${bucket}/${key}`,
      `--file=${file}`,
      '--local',
      '--config',
      'wrangler.jsonc',
      '--persist-to',
      '.wrangler/state',
    ],
    { cwd: root, encoding: 'utf8', stdio: 'inherit' },
  );

  if (result.status !== 0) {
    console.error(`seed-r2 failed for ${bucket}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`seed-r2 ok → ${key} (${buckets.join(', ')})`);
