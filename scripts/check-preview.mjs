#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { parse } from 'jsonc-parser';

const allowedConfigFields = new Set([
  '$schema',
  'assets',
  'compatibility_date',
  'name',
  'preview_urls',
  'routes',
  'workers_dev',
]);

class PreviewPolicyError extends Error {
  constructor(category) {
    super(category);
    this.category = category;
  }
}

function commandOptions() {
  const values = process.argv.slice(2);
  let root = process.cwd();
  let phase = 'post-build';
  const seen = new Set();
  while (values.length > 0) {
    const option = values.shift();
    const value = values.shift();
    if (!['--phase', '--root'].includes(option) || !value || seen.has(option)) {
      throw new Error('invalid arguments');
    }
    seen.add(option);
    if (option === '--root') root = resolve(value);
    else if (['pre-build', 'post-build'].includes(value)) phase = value;
    else throw new Error('invalid arguments');
  }
  return { phase, root };
}

async function main() {
  const { phase, root } = commandOptions();
  const parseErrors = [];
  const config = parse(await readFile(join(root, 'wrangler.jsonc'), 'utf-8'), parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (parseErrors.length !== 0 || !config || typeof config !== 'object') {
    throw new PreviewPolicyError('invalid-preview-config');
  }
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf-8'));
  if (Object.keys(config).some((field) => !allowedConfigFields.has(field))) {
    throw new PreviewPolicyError('preview-config-field-forbidden');
  }
  if (config.name !== 'sangrep-docs-preview' || config.compatibility_date !== '2026-07-01') {
    throw new PreviewPolicyError('preview-worker-identity-invalid');
  }
  const assetFields =
    config.assets && typeof config.assets === 'object' ? Object.keys(config.assets).sort() : [];
  if (
    assetFields.join(',') !== 'directory,html_handling,not_found_handling' ||
    config.assets.directory !== './dist' ||
    config.assets.html_handling !== 'auto-trailing-slash' ||
    config.assets.not_found_handling !== '404-page'
  ) {
    throw new PreviewPolicyError('preview-assets-invalid');
  }
  if (
    packageJson.scripts?.build !== 'astro build' ||
    packageJson.scripts?.['check:preview-config'] !==
      'node scripts/check-preview.mjs --phase pre-build' ||
    packageJson.scripts?.['check:preview'] !==
      'node scripts/check-preview.mjs --phase post-build && wrangler versions upload --dry-run --outdir output/wrangler-preview' ||
    packageJson.scripts?.['preview:upload'] !==
      'npm run check:preview-config && npm run build && npm run check:preview && wrangler versions upload --preview-alias review --strict'
  ) {
    throw new PreviewPolicyError('preview-command-invalid');
  }
  if (
    packageJson.devDependencies?.wrangler !== '4.128.0' ||
    packageJson.devDependencies?.['jsonc-parser'] !== '3.3.1'
  ) {
    throw new PreviewPolicyError('preview-tool-version-invalid');
  }
  if (!Array.isArray(config.routes) || config.routes.length !== 0) {
    throw new PreviewPolicyError('preview-routes-forbidden');
  }
  if (config.workers_dev !== true || config.preview_urls !== true) {
    throw new PreviewPolicyError('preview-only-required');
  }
  if (phase === 'post-build') {
    let index;
    try {
      index = await stat(join(root, 'dist/index.html'));
    } catch {
      throw new PreviewPolicyError('preview-build-missing');
    }
    if (!index.isFile()) throw new PreviewPolicyError('preview-build-missing');
  }
  console.log(`preview-policy: passed phase=${phase}`);
}

main().catch((error) => {
  const category = error instanceof PreviewPolicyError ? error.category : 'invalid-preview-config';
  console.error(`preview-policy: blocked category=${category}`);
  process.exitCode = 1;
});
