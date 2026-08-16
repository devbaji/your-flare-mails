import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/emails',
);

const REQUIRED = [
  'plain-text.eml',
  'multipart-html-attachment.eml',
  'inline-image.eml',
  'missing-threading-headers.eml',
  'malformed-mime.eml',
  'malicious-html.eml',
  'oversized-marker.eml',
  'subject-fallback-root.eml',
  'subject-fallback-reply.eml',
  'references-chain-1.eml',
  'references-chain-2.eml',
  'references-chain-3.eml',
];

function assertHasHeader(raw, name, file) {
  const re = new RegExp(`^${name}:`, 'im');
  if (!re.test(raw)) {
    throw new Error(`${file}: missing required header ${name}`);
  }
}

async function main() {
  const entries = await readdir(FIXTURES_DIR);
  const emlFiles = entries.filter((name) => name.endsWith('.eml'));

  for (const required of REQUIRED) {
    if (!emlFiles.includes(required)) {
      throw new Error(`Missing required fixture: ${required}`);
    }
  }

  for (const file of emlFiles) {
    const fullPath = path.join(FIXTURES_DIR, file);
    const info = await stat(fullPath);
    if (info.size === 0) {
      throw new Error(`${file}: empty fixture`);
    }

    const raw = await readFile(fullPath, 'utf8');
    assertHasHeader(raw, 'From', file);
    assertHasHeader(raw, 'To', file);
    assertHasHeader(raw, 'Subject', file);

    if (file === 'malicious-html.eml' && !/<script/i.test(raw)) {
      throw new Error(`${file}: expected a <script> tag for sanitizer tests`);
    }

    if (file === 'malformed-mime.eml' && !/boundary="broken/i.test(raw)) {
      throw new Error(`${file}: expected intentionally broken boundary`);
    }

    if (file === 'missing-threading-headers.eml' && /^Message-ID:/im.test(raw)) {
      throw new Error(`${file}: must not include Message-ID`);
    }

    if (file === 'oversized-marker.eml' && !raw.includes('OVERSIZED_FIXTURE_MARKER')) {
      throw new Error(`${file}: missing OVERSIZED_FIXTURE_MARKER`);
    }
  }

  console.log(`fixtures:check ok (${emlFiles.length} .eml files)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
