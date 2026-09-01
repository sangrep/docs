import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import test from 'node:test';

const repositoryRoot = new URL('../', import.meta.url);
const buildPolicyScript = new URL('../scripts/check-build.mjs', import.meta.url);

const releasedFrontmatter = `---
title: Documentation home
description: Released documentation home.
status: Released
platforms: [Web]
version: Documentation foundation
limitations: This is not a Workbench availability claim.
privacy: No workspace content is sent.
recovery: Return to the documentation home.
contentType: overview
draft: false
pagefind: true
---

Released documentation.
`;

const previewFrontmatter = `---
title: Hidden preview guide
description: Review-only guidance.
status: Preview
platforms: [macOS]
version: Development build
limitations: This is not publicly available.
privacy: No document content is sent.
recovery: Close the development build.
contentType: overview
draft: true
pagefind: false
---

Review-only guidance.
`;

const accessibleHome = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="description" content="Released documentation home.">
    <link rel="canonical" href="https://docs.sangrep.com/">
    <title>Documentation home</title>
  </head>
  <body>
    <a href="#main">Skip to content</a>
    <nav aria-label="Main navigation"><a href="/">Home</a></nav>
    <main id="main">
      <h1>Documentation home</h1>
      <section aria-labelledby="guide-status-heading">
        <h2 id="guide-status-heading">Guide status</h2>
        <dl data-guide-status="Released">
          <dt>Status</dt><dd>Released</dd>
          <dt>Platform</dt><dd>Web</dd>
          <dt>Version</dt><dd>Documentation foundation</dd>
          <dt>Privacy</dt><dd>No workspace content is sent.</dd>
          <dt>Limitations</dt><dd>This is not a Workbench availability claim.</dd>
          <dt>Recovery</dt><dd>Return to the documentation home.</dd>
        </dl>
      </section>
    </main>
  </body>
</html>
`;

async function runBuildPolicy({ distFiles, contentFiles }) {
  const root = await mkdtemp(join(tmpdir(), 'sangrep-docs-build-policy-'));
  const distRoot = join(root, 'dist');
  const contentRoot = join(root, 'content');
  try {
    const completeDistFiles = {
      'media-manifest.json': '{"schemaVersion":"sangrep.docs.media.v1","assets":[]}',
      ...distFiles,
    };
    for (const [relativePath, content] of Object.entries(completeDistFiles)) {
      const absolutePath = join(distRoot, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    }
    for (const [relativePath, content] of Object.entries(contentFiles)) {
      const absolutePath = join(contentRoot, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    }

    return spawnSync(
      process.execPath,
      [
        buildPolicyScript.pathname,
        '--dist',
        distRoot,
        '--content-root',
        contentRoot,
        '--format',
        'json',
      ],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('accepts a static build containing every Released route and no hidden content', async () => {
  const result = await runBuildPolicy({
    contentFiles: {
      'index.md': releasedFrontmatter,
      'review/index.md': previewFrontmatter,
    },
    distFiles: {
      'index.html': accessibleHome,
      'pagefind/pagefind-entry.json': '{"url":"/","title":"Documentation home"}',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    hiddenRoutes: 1,
    htmlPages: 1,
    publicRoutes: 1,
  });
});

test('rejects a build missing a Released route', async () => {
  const result = await runBuildPolicy({
    contentFiles: { 'index.md': releasedFrontmatter },
    distFiles: { '404.html': accessibleHome },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=missing-released-route/);
});

test('rejects hidden routes or titles leaked into build output and search', async () => {
  const result = await runBuildPolicy({
    contentFiles: {
      'index.md': releasedFrontmatter,
      'review/index.md': previewFrontmatter,
    },
    distFiles: {
      'index.html': accessibleHome,
      'review/index.html': accessibleHome.replaceAll('Documentation home', 'Hidden preview guide'),
      'pagefind/pagefind-entry.json': '{"url":"/review/","title":"Hidden preview guide"}',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=hidden-route-leak/);
  assert.match(result.stderr, /category=hidden-content-leak/);
});

test('rejects hidden content inside compressed Pagefind fragments', async () => {
  const result = await runBuildPolicy({
    contentFiles: {
      'index.md': releasedFrontmatter,
      'review/index.md': previewFrontmatter,
    },
    distFiles: {
      'index.html': accessibleHome,
      'pagefind/fragment/en_hidden.pf_fragment': gzipSync(
        'pagefind_dcd{"url":"/review/","title":"Hidden preview guide"}',
        { mtime: 0 },
      ),
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=hidden-content-leak/);
});

test('rejects generated HTML without baseline accessibility landmarks and metadata', async () => {
  const inaccessibleHome =
    '<!doctype html><html><head><title>Home</title></head><body><h1>Home</h1></body></html>';
  const result = await runBuildPolicy({
    contentFiles: { 'index.md': releasedFrontmatter },
    distFiles: { 'index.html': inaccessibleHome },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=html-accessibility/);
  assert.match(result.stderr, /category=html-metadata/);
});

test('rejects a generated guide that omits its visible status lens', async () => {
  const result = await runBuildPolicy({
    contentFiles: { 'index.md': releasedFrontmatter },
    distFiles: {
      'index.html': accessibleHome.replace(/\s*<section[\s\S]*?<\/section>/, ''),
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=guide-status/);
});
