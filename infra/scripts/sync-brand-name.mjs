#!/usr/bin/env node
/**
 * Sync YFM_BRAND_NAME into native shell labels (Tauri + Android strings).
 * Called from deploy:configure and desktop brand-aware build wrappers.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function loadDeployEnv() {
  const path = resolve(root, process.env.DEPLOY_ENV_FILE || 'config/deploy.local.env');
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return out;
}

export function resolveBrandName(env = loadDeployEnv()) {
  return (
    process.env.YFM_BRAND_NAME?.trim() ||
    process.env.NUXT_PUBLIC_YFM_BRAND_NAME?.trim() ||
    env.YFM_BRAND_NAME?.trim() ||
    env.NUXT_PUBLIC_YFM_BRAND_NAME?.trim() ||
    'Devbaji Mails'
  );
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function syncBrandName(brandName = resolveBrandName()) {
  const tauriConfPath = join(root, 'apps/desktop/src-tauri/tauri.conf.json');
  const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  tauriConf.productName = brandName;
  if (Array.isArray(tauriConf.app?.windows) && tauriConf.app.windows[0]) {
    tauriConf.app.windows[0].title = brandName;
  }
  writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`);

  const stringsPath = join(
    root,
    'apps/desktop/src-tauri/gen/android/app/src/main/res/values/strings.xml',
  );
  if (existsSync(stringsPath)) {
    const xml = `<resources>
    <string name="app_name">${escapeXml(brandName)}</string>
    <string name="main_activity_title">${escapeXml(brandName)}</string>
</resources>
`;
    writeFileSync(stringsPath, xml);
  }

  return brandName;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  const brand = syncBrandName();
  console.log(`Synced brand name: ${brand}`);
}
