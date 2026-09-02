import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const policyScript = new URL('../scripts/check-preview.mjs', import.meta.url);
const productionCommand = ['wrangler', 'deploy'].join(' ');

const safeConfig = {
  $schema: 'node_modules/wrangler/config-schema.json',
  name: 'sangrep-docs-preview',
  compatibility_date: '2026-07-01',
  workers_dev: true,
  preview_urls: true,
  routes: [],
  assets: {
    directory: './dist',
    html_handling: 'auto-trailing-slash',
    not_found_handling: '404-page',
  },
};

const safePackage = {
  scripts: {
    build: 'astro build',
    'check:preview-config': 'node scripts/check-preview.mjs --phase pre-build',
    'check:preview':
      'node scripts/check-preview.mjs --phase post-build && wrangler versions upload --dry-run --outdir output/wrangler-preview',
    'preview:upload':
      'npm run check:preview-config && npm run build && npm run check:preview && wrangler versions upload --preview-alias review --strict',
  },
  devDependencies: {
    'jsonc-parser': '3.3.1',
    wrangler: '4.128.0',
  },
};

async function runPolicy({
  config = safeConfig,
  configText,
  packageJson = safePackage,
  phase,
  withIndex = true,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'sangrep-docs-preview-policy-'));
  await mkdir(join(root, 'dist'), { recursive: true });
  if (withIndex) {
    await writeFile(join(root, 'dist/index.html'), '<!doctype html><title>Preview</title>\n');
  }
  await writeFile(
    join(root, 'wrangler.jsonc'),
    configText ?? `${JSON.stringify(config, null, 2)}\n`,
  );
  await writeFile(join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

  const commandArguments = [policyScript.pathname, '--root', root];
  if (phase) commandArguments.push('--phase', phase);
  const result = spawnSync(process.execPath, commandArguments, {
    encoding: 'utf-8',
  });
  await rm(root, { recursive: true, force: true });
  return result;
}

test('accepts a route-free preview configuration', async () => {
  const result = await runPolicy();

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /preview-policy: passed/);
});

test('accepts formatted JSONC with comments and trailing commas', async () => {
  const configText = `{
    // Route-free preview only.
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "sangrep-docs-preview",
    "compatibility_date": "2026-07-01",
    "workers_dev": true,
    "preview_urls": true,
    "routes": [],
    "assets": {
      "directory": "./dist",
      "html_handling": "auto-trailing-slash",
      "not_found_handling": "404-page",
    },
  }\n`;

  const result = await runPolicy({ configText });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /preview-policy: passed/);
});

test('rejects any configured route or custom domain', async () => {
  const config = structuredClone(safeConfig);
  config.routes = [{ pattern: 'docs.example.invalid', custom_domain: true }];

  const result = await runPolicy({ config });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=preview-routes-forbidden/);
});

test('requires workers.dev and version preview URLs', async () => {
  for (const field of ['workers_dev', 'preview_urls']) {
    const config = structuredClone(safeConfig);
    config[field] = false;

    const result = await runPolicy({ config });

    assert.notEqual(result.status, 0, field);
    assert.match(result.stderr, /category=preview-only-required/, field);
  }
});

test('rejects environments, bindings, and triggers', async () => {
  for (const [field, value] of [
    ['env', { preview: {} }],
    ['vars', { MODE: 'preview' }],
    ['triggers', { crons: ['0 0 * * *'] }],
  ]) {
    const config = structuredClone(safeConfig);
    config[field] = value;

    const result = await runPolicy({ config });

    assert.notEqual(result.status, 0, field);
    assert.match(result.stderr, /category=preview-config-field-forbidden/, field);
  }
});

test('requires the dedicated preview worker identity', async () => {
  for (const [field, value] of [
    ['name', 'sangrep-docs'],
    ['compatibility_date', '2026-09-02'],
  ]) {
    const config = structuredClone(safeConfig);
    config[field] = value;

    const result = await runPolicy({ config });

    assert.notEqual(result.status, 0, field);
    assert.match(result.stderr, /category=preview-worker-identity-invalid/, field);
  }
});

test('requires the exact static documentation asset behavior', async () => {
  const mutations = [
    (config) => (config.assets.directory = './out'),
    (config) => (config.assets.html_handling = 'drop-trailing-slash'),
    (config) => (config.assets.not_found_handling = 'single-page-application'),
    (config) => (config.assets.binding = 'ASSETS'),
  ];

  for (const mutate of mutations) {
    const config = structuredClone(safeConfig);
    mutate(config);

    const result = await runPolicy({ config });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /category=preview-assets-invalid/);
  }
});

test('rejects upload commands that can skip build, dry run, or version-only upload', async () => {
  const mutations = [
    (packageJson) => (packageJson.scripts['preview:upload'] = productionCommand),
    (packageJson) =>
      (packageJson.scripts['preview:upload'] =
        'npm run build && wrangler versions upload --preview-alias review'),
    (packageJson) => (packageJson.scripts['check:preview'] = 'node scripts/check-preview.mjs'),
  ];

  for (const mutate of mutations) {
    const packageJson = structuredClone(safePackage);
    mutate(packageJson);

    const result = await runPolicy({ packageJson });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /category=preview-command-invalid/);
  }
});

test('rejects a production-capable build command', async () => {
  const packageJson = structuredClone(safePackage);
  packageJson.scripts.build = productionCommand;

  const result = await runPolicy({ packageJson });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=preview-command-invalid/);
});

test('pre-build policy validates configuration without requiring dist', async () => {
  const result = await runPolicy({ phase: 'pre-build', withIndex: false });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /preview-policy: passed phase=pre-build/);
});

test('pre-build policy rejects an upload chain that executes build before validation', async () => {
  const packageJson = structuredClone(safePackage);
  packageJson.scripts['preview:upload'] =
    'npm run build && npm run check:preview && wrangler versions upload --preview-alias review --strict';

  const result = await runPolicy({ packageJson, phase: 'pre-build', withIndex: false });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=preview-command-invalid/);
});

test('requires audited preview tool versions without ranges', async () => {
  for (const [tool, versions] of [
    ['wrangler', ['^4.128.0', 'latest', undefined]],
    ['jsonc-parser', ['^3.3.1', 'latest', undefined]],
  ]) {
    for (const version of versions) {
      const packageJson = structuredClone(safePackage);
      if (version === undefined) delete packageJson.devDependencies[tool];
      else packageJson.devDependencies[tool] = version;

      const result = await runPolicy({ packageJson });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /category=preview-tool-version-invalid/);
    }
  }
});

test('rejects an upload when the static build is missing', async () => {
  const result = await runPolicy({ withIndex: false });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=preview-build-missing/);
});
