import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';

const repositoryRoot = new URL('../', import.meta.url);
const policyScript = new URL('../scripts/check-content.mjs', import.meta.url);

const releasedPage = `---
title: Read the documentation
description: Find guidance that matches released Sangrep Workbench behavior.
status: Released
platforms:
  - Web
version: Documentation foundation
limitations: This page does not claim that a Workbench installer is available.
privacy: Reading this page does not send workspace or document content.
recovery: Return to this page if a guide is unavailable.
contentType: overview
draft: false
pagefind: true
---

Released guidance appears here.
`;

const previewPage = `---
title: Review a preview
description: Review incomplete guidance without publishing it.
status: Preview
platforms:
  - macOS
version: Development build
limitations: This is not available in a public build.
privacy: No document content is sent by this workflow.
recovery: Close the development build to leave the preview.
contentType: overview
draft: true
pagefind: false
---

This page is visible only while reviewing source or a development server.
`;

const unreleasedPage = `---
title: Use an unreleased workflow
description: Review verified behavior before a packaged release.
status: Unreleased
platforms:
  - macOS
version: Development build
limitations: No public installer is available.
privacy: The workflow keeps document content on this device.
recovery: Quit the development build if the local service cannot stop.
contentType: task
expectedResult: The development build shows a verified local state.
draft: true
pagefind: false
---

1. Open the development build.
2. Confirm the visible local state.
`;

async function runPolicy(files, publicFiles = {}) {
  const contentRoot = await mkdtemp(join(tmpdir(), 'sangrep-docs-policy-'));
  const publicRoot = join(contentRoot, '_public');
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = join(contentRoot, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    }
    const completePublicFiles = {
      'media-manifest.json': '{"schemaVersion":"sangrep.docs.media.v1","assets":[]}',
      ...publicFiles,
    };
    for (const [relativePath, content] of Object.entries(completePublicFiles)) {
      const absolutePath = join(publicRoot, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    }

    const result = spawnSync(
      process.execPath,
      [
        policyScript.pathname,
        '--root',
        contentRoot,
        '--public-root',
        publicRoot,
        '--format',
        'json',
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
      },
    );
    return result;
  } finally {
    await rm(contentRoot, { recursive: true, force: true });
  }
}

test('publishes Released routes and filters Preview and Unreleased routes', async () => {
  const result = await runPolicy({
    'index.md': releasedPage,
    'review/index.md': previewPage,
    'workspaces/create.md': unreleasedPage,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).publicRoutes, ['/']);
});

test('rejects a page that omits required availability metadata', async () => {
  const result = await runPolicy({
    'index.md': releasedPage.replace('platforms:\n  - Web\n', ''),
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=metadata-missing/);
});

test('rejects content outside the task-oriented route map', async () => {
  const result = await runPolicy({ 'misc/page.md': releasedPage });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=content-route/);
});

test('rejects a hidden status that could enter production routes or search', async () => {
  const result = await runPolicy({
    'review/index.md': previewPage.replace('draft: true', 'draft: false'),
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=release-filter/);
});

test('rejects a Released page that links to a hidden page', async () => {
  const result = await runPolicy({
    'index.md': releasedPage.replace(
      'Released guidance appears here.',
      'Read the [preview workflow](/review/).',
    ),
    'review/index.md': previewPage,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=released-link-hidden/);
});

test('rejects broken internal links', async () => {
  const result = await runPolicy({
    'index.md': releasedPage.replace(
      'Released guidance appears here.',
      'Read [missing guidance](/missing/).',
    ),
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=broken-link/);
});

test('rejects duplicate substantive pages without canonical-source metadata', async () => {
  const duplicate = releasedPage.replace(
    'title: Read the documentation',
    'title: Documentation copy',
  );
  const result = await runPolicy({
    'index.md': releasedPage,
    'copy.md': duplicate,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=duplicate-content/);
});

test('rejects task guidance without numbered steps or an expected result', async () => {
  const result = await runPolicy({
    'workspaces/create.md': unreleasedPage
      .replace('expectedResult: The development build shows a verified local state.\n', '')
      .replace(
        '1. Open the development build.\n2. Confirm the visible local state.',
        'Open the development build.',
      ),
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=task-contract/);
});

test('accepts semantic HTML ordered steps in MDX task content', async () => {
  const result = await runPolicy({
    'workspaces/create.mdx': unreleasedPage.replace(
      '1. Open the development build.\n2. Confirm the visible local state.',
      '<ol><li>Open the development build.</li><li>Confirm the visible local state.</li></ol>',
    ),
  });

  assert.equal(result.status, 0, result.stderr);
});

test('rejects images with empty alt text or missing media', async () => {
  const result = await runPolicy({
    'index.md': releasedPage.replace(
      'Released guidance appears here.',
      '![](/screenshots/missing.png)',
    ),
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=image-alt/);
  assert.match(result.stderr, /category=missing-media/);
});

test('rejects public media without a released provenance record', async () => {
  const result = await runPolicy(
    {
      'index.md': releasedPage.replace(
        'Released guidance appears here.',
        '![Workspace status](/screenshots/workspace.svg)',
      ),
    },
    {
      'screenshots/workspace.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=media-provenance/);
});

test('rejects a media record whose digest does not match its bytes', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const result = await runPolicy(
    {
      'index.md': releasedPage.replace(
        'Released guidance appears here.',
        '![Workspace status](/screenshots/workspace.png)',
      ),
    },
    {
      'media-manifest.json': JSON.stringify({
        schemaVersion: 'sangrep.docs.media.v1',
        assets: [
          {
            path: 'screenshots/workspace.png',
            kind: 'screenshot',
            status: 'Released',
            source: 'Sangrep Workbench release capture',
            license: 'LicenseRef-Sangrep-Brand-Content',
            alt: 'Workspace status',
            sha256: '0'.repeat(64),
          },
        ],
      }),
      'screenshots/workspace.png': png,
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=media-digest/);
});

test('rejects active SVG from the public screenshot and recording lane', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  const result = await runPolicy(
    { 'index.md': releasedPage },
    {
      'media-manifest.json': JSON.stringify({
        schemaVersion: 'sangrep.docs.media.v1',
        assets: [
          {
            path: 'screenshots/workspace.svg',
            kind: 'screenshot',
            status: 'Released',
            source: 'Sangrep Workbench release capture',
            license: 'LicenseRef-Sangrep-Brand-Content',
            alt: 'Workspace status',
            sha256: createHash('sha256').update(svg).digest('hex'),
          },
        ],
      }),
      'screenshots/workspace.svg': svg,
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=media-type/);
});

test('requires product technical pages to point to a canonical component reference', async () => {
  const result = await runPolicy({
    'configuration/technical.md': releasedPage
      .replace('contentType: overview', 'contentType: technical-reference')
      .replace('Released guidance appears here.', 'Configure the public extension point.'),
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=canonical-reference/);
});

test('requires the canonical technical reference to be linked from the page body', async () => {
  const result = await runPolicy({
    'configuration/technical.md': releasedPage
      .replace('contentType: overview', 'contentType: technical-reference')
      .replace(
        'draft: false',
        'technicalReference: https://sangrep.github.io/harness/\ndraft: false',
      )
      .replace(
        'Released guidance appears here.',
        'Technical details stay in their component docs.',
      ),
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /category=canonical-reference/);
});
