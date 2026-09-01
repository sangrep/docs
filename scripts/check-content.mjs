#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';

const allowedStatuses = new Set(['Released', 'Preview', 'Unreleased']);
const allowedPlatforms = new Set(['Web', 'macOS', 'Windows']);
const allowedContentTypes = new Set([
  'overview',
  'task',
  'reference',
  'release',
  'technical-reference',
]);
const allowedRouteRoots = new Set([
  'configuration',
  'packs',
  'privacy',
  'providers',
  'recovery',
  'releases',
  'review',
  'start',
  'troubleshooting',
  'workspaces',
]);
const mediaExtensions = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.mp4',
  '.png',
  '.svg',
  '.webm',
  '.webp',
]);
const mediaKinds = new Set(['illustration', 'recording', 'screenshot']);
const mediaLicenses = new Set(['Apache-2.0', 'CC-BY-4.0', 'LicenseRef-Sangrep-Brand-Content']);
const maximumMediaBytes = 8 * 1024 * 1024;

function parseArguments(argv) {
  const options = {
    root: 'src/content/docs',
    publicRoot: 'public',
    format: 'text',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root' || argument === '--public-root' || argument === '--format') {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing value for ${argument}`);
      options[argument.slice(2).replace('-r', 'R')] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  if (!['json', 'text'].includes(options.format)) throw new Error('format must be json or text');
  return options;
}

async function markdownFiles(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name))) files.push(path);
    }
  }
  await visit(root);
  return files;
}

function splitFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) return { data: null, body: source };
  try {
    return { data: parseYaml(match[1]), body: match[2] };
  } catch {
    return { data: null, body: match[2] };
  }
}

function routeFor(relativePath) {
  const withoutExtension = relativePath.replace(/\.(?:md|mdx)$/i, '');
  const route =
    withoutExtension === 'index'
      ? '/'
      : withoutExtension.endsWith('/index')
        ? `/${withoutExtension.slice(0, -'/index'.length)}/`
        : `/${withoutExtension}/`;
  return route.replaceAll(sep, '/');
}

function normalizedRoute(href, sourceRoute) {
  const withoutFragment = href.split(/[?#]/, 1)[0];
  if (!withoutFragment) return null;
  let route;
  if (withoutFragment.startsWith('/')) {
    route = withoutFragment;
  } else {
    const base = sourceRoute.endsWith('/') ? sourceRoute : `${sourceRoute}/`;
    route = new URL(withoutFragment, `https://docs.invalid${base}`).pathname;
  }
  route = route.replace(/\.(?:md|mdx)$/i, '');
  if (!route.endsWith('/') && !extname(route)) route += '/';
  return route;
}

function isExternal(href) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

function markdownLinks(body) {
  const links = [];
  const pattern = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of body.matchAll(pattern)) {
    links.push({
      image: match[1] === '!',
      alt: match[2].trim(),
      href: match[3],
    });
  }
  return links;
}

function stringValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function finding(category, path, detail) {
  return { category, path, detail };
}

function validateMetadata(page) {
  const findings = [];
  const data = page.data;
  const [routeRoot] = page.relativePath.split('/');
  if (
    page.relativePath !== 'index.md' &&
    page.relativePath !== 'index.mdx' &&
    !allowedRouteRoots.has(routeRoot)
  ) {
    findings.push(
      finding('content-route', page.relativePath, 'page is outside the task-oriented route map'),
    );
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [finding('metadata-invalid', page.relativePath, 'frontmatter must be a YAML object')];
  }
  for (const field of ['title', 'description', 'version', 'limitations', 'privacy', 'recovery']) {
    if (!stringValue(data[field]))
      findings.push(finding('metadata-missing', page.relativePath, field));
  }
  if (!allowedStatuses.has(data.status))
    findings.push(finding('metadata-invalid', page.relativePath, 'status'));
  if (
    !Array.isArray(data.platforms) ||
    data.platforms.length === 0 ||
    data.platforms.some((platform) => !allowedPlatforms.has(platform))
  ) {
    findings.push(finding('metadata-missing', page.relativePath, 'platforms'));
  }
  if (!allowedContentTypes.has(data.contentType)) {
    findings.push(finding('metadata-invalid', page.relativePath, 'contentType'));
  }

  const released = data.status === 'Released';
  if (released && (data.draft !== false || data.pagefind !== true)) {
    findings.push(
      finding(
        'release-filter',
        page.relativePath,
        'Released must set draft=false and pagefind=true',
      ),
    );
  }
  if (
    !released &&
    allowedStatuses.has(data.status) &&
    (data.draft !== true || data.pagefind !== false)
  ) {
    findings.push(
      finding(
        'release-filter',
        page.relativePath,
        'hidden status must set draft=true and pagefind=false',
      ),
    );
  }
  if (data.contentType === 'task') {
    const hasOrderedSteps =
      /^\s*1\.\s+\S/m.test(page.body) ||
      /<ol(?:\s[^>]*)?>[\s\S]*?<li(?:\s[^>]*)?>/i.test(page.body);
    if (!stringValue(data.expectedResult) || !hasOrderedSteps) {
      findings.push(
        finding('task-contract', page.relativePath, 'task needs expectedResult and numbered steps'),
      );
    }
  }
  if (data.contentType === 'technical-reference' || data.technicalReference !== undefined) {
    if (!stringValue(data.technicalReference) || !/^https:\/\//.test(data.technicalReference)) {
      findings.push(
        finding(
          'canonical-reference',
          page.relativePath,
          'technicalReference must be an HTTPS URL',
        ),
      );
    } else if (
      !markdownLinks(page.body).some((link) => !link.image && link.href === data.technicalReference)
    ) {
      findings.push(
        finding(
          'canonical-reference',
          page.relativePath,
          'page body must link to technicalReference',
        ),
      );
    }
  }
  return findings;
}

function substantiveDigest(body) {
  const normalizedBody = body
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
  if (normalizedBody.length < 24) return null;
  return createHash('sha256').update(normalizedBody).digest('hex');
}

function resolveMediaPath(page, href, contentRoot, publicRoot) {
  const cleanHref = href.split(/[?#]/, 1)[0];
  if (cleanHref.startsWith('/')) return resolve(publicRoot, `.${cleanHref}`);
  return resolve(dirname(join(contentRoot, page.relativePath)), cleanHref);
}

function pathWithin(path, root) {
  const pathRelativeToRoot = relative(resolve(root), resolve(path));
  return (
    pathRelativeToRoot === '' ||
    (!pathRelativeToRoot.startsWith('..') && !pathRelativeToRoot.includes(`..${sep}`))
  );
}

function validateLinksAndMedia(pages, contentRoot, publicRoot, mediaRecords) {
  const findings = [];
  const routeMap = new Map(pages.map((page) => [page.route, page]));
  for (const page of pages) {
    for (const link of markdownLinks(page.body)) {
      if (link.image) {
        if (!link.alt) findings.push(finding('image-alt', page.relativePath, link.href));
        if (isExternal(link.href)) continue;
        const mediaPath = resolveMediaPath(page, link.href, contentRoot, publicRoot);
        const permittedRoot = link.href.startsWith('/') ? publicRoot : contentRoot;
        if (!pathWithin(mediaPath, permittedRoot) || !existsSync(mediaPath)) {
          findings.push(finding('missing-media', page.relativePath, link.href));
          continue;
        }
        const extension = extname(mediaPath).toLowerCase();
        if (!mediaExtensions.has(extension))
          findings.push(finding('media-type', page.relativePath, link.href));
        if (statSync(mediaPath).size > maximumMediaBytes)
          findings.push(finding('media-size', page.relativePath, link.href));
        if (!link.href.startsWith('/screenshots/') && !link.href.startsWith('/recordings/')) {
          findings.push(finding('media-location', page.relativePath, link.href));
          continue;
        }
        const manifestPath = relative(publicRoot, mediaPath).split(sep).join('/');
        const mediaRecord = mediaRecords.get(manifestPath);
        if (!mediaRecord) {
          findings.push(finding('media-provenance', page.relativePath, link.href));
        } else if (mediaRecord.alt !== link.alt) {
          findings.push(
            finding('image-alt', page.relativePath, 'alt text differs from media manifest'),
          );
        }
        continue;
      }
      if (isExternal(link.href) || link.href.startsWith('#')) continue;
      const targetRoute = normalizedRoute(link.href, page.route);
      const target = targetRoute ? routeMap.get(targetRoute) : null;
      if (!target) {
        findings.push(finding('broken-link', page.relativePath, link.href));
        continue;
      }
      if (page.data?.status === 'Released' && target.data?.status !== 'Released') {
        findings.push(finding('released-link-hidden', page.relativePath, link.href));
      }
    }
  }
  return findings;
}

async function filesUnderIfPresent(root) {
  if (!existsSync(root)) return [];
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (entry.isFile()) files.push(path);
    }
  }
  await visit(root);
  return files;
}

async function loadMediaManifest(publicRoot) {
  const manifestPath = join(publicRoot, 'media-manifest.json');
  const findings = [];
  const records = new Map();
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return {
      findings: [
        finding('media-manifest', 'public/media-manifest.json', 'missing or invalid JSON'),
      ],
      records,
    };
  }
  if (
    !manifest ||
    manifest.schemaVersion !== 'sangrep.docs.media.v1' ||
    !Array.isArray(manifest.assets)
  ) {
    return {
      findings: [finding('media-manifest', 'public/media-manifest.json', 'invalid schema')],
      records,
    };
  }
  for (const asset of manifest.assets) {
    const path = typeof asset?.path === 'string' ? asset.path : '';
    if (
      !path ||
      (!path.startsWith('screenshots/') && !path.startsWith('recordings/')) ||
      records.has(path)
    ) {
      findings.push(
        finding(
          'media-manifest',
          'public/media-manifest.json',
          'asset path is invalid or duplicated',
        ),
      );
      continue;
    }
    records.set(path, asset);
    const absolutePath = resolve(publicRoot, path);
    if (!pathWithin(absolutePath, publicRoot) || !existsSync(absolutePath)) {
      findings.push(finding('media-provenance', path, 'inventoried asset is missing'));
      continue;
    }
    if (
      !mediaKinds.has(asset.kind) ||
      asset.status !== 'Released' ||
      !stringValue(asset.source) ||
      !mediaLicenses.has(asset.license) ||
      !stringValue(asset.alt) ||
      !/^[0-9a-f]{64}$/.test(asset.sha256 ?? '')
    ) {
      findings.push(finding('media-provenance', path, 'record is incomplete or not Released'));
      continue;
    }
    const bytes = await readFile(absolutePath);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== asset.sha256) findings.push(finding('media-digest', path, 'SHA-256 mismatch'));
  }
  for (const rootName of ['screenshots', 'recordings']) {
    const root = join(publicRoot, rootName);
    for (const path of await filesUnderIfPresent(root)) {
      const manifestRelative = relative(publicRoot, path).split(sep).join('/');
      if (!records.has(manifestRelative)) {
        findings.push(
          finding('media-provenance', manifestRelative, 'public media is not inventoried'),
        );
      }
    }
  }
  return { findings, records };
}

function validateDuplicates(pages) {
  const byDigest = new Map();
  for (const page of pages) {
    const digest = substantiveDigest(page.body);
    if (!digest) continue;
    const group = byDigest.get(digest) ?? [];
    group.push(page);
    byDigest.set(digest, group);
  }
  const findings = [];
  for (const group of byDigest.values()) {
    if (group.length < 2 || group.some((page) => stringValue(page.data?.canonicalSource))) continue;
    for (const page of group) {
      findings.push(
        finding('duplicate-content', page.relativePath, 'substantive body matches another page'),
      );
    }
  }
  return findings;
}

export async function loadPages(contentRoot) {
  const root = resolve(contentRoot);
  if (!existsSync(root)) throw new Error('content root does not exist');
  const paths = await markdownFiles(root);
  if (paths.length === 0) throw new Error('content root contains no Markdown or MDX pages');
  return Promise.all(
    paths.map(async (path) => {
      const source = await readFile(path, 'utf8');
      const relativePath = relative(root, path).split(sep).join('/');
      const { data, body } = splitFrontmatter(source);
      return { relativePath, route: routeFor(relativePath), data, body };
    }),
  );
}

export async function inspectContent(contentRoot, publicRoot) {
  const pages = await loadPages(contentRoot);
  const media = await loadMediaManifest(publicRoot);
  const findings = [
    ...media.findings,
    ...pages.flatMap(validateMetadata),
    ...validateLinksAndMedia(pages, contentRoot, publicRoot, media.records),
    ...validateDuplicates(pages),
  ];
  return {
    findings,
    pages,
    report: {
      pageCount: pages.length,
      publicRoutes: pages
        .filter((page) => page.data?.status === 'Released')
        .map((page) => page.route)
        .sort(),
    },
  };
}

function renderFinding(value) {
  return `content-check: blocked category=${value.category} path=${value.path} detail=${value.detail}`;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const contentRoot = resolve(options.root);
    const publicRoot = resolve(options.publicRoot);
    const { findings, report } = await inspectContent(contentRoot, publicRoot);
    if (findings.length > 0) {
      for (const value of findings) process.stderr.write(`${renderFinding(value)}\n`);
      process.exitCode = 1;
      return;
    }
    if (options.format === 'json') process.stdout.write(`${JSON.stringify(report)}\n`);
    else
      process.stdout.write(
        `content-check: passed pages=${report.pageCount} public_routes=${report.publicRoutes.length}\n`,
      );
  } catch (error) {
    process.stderr.write(`content-check: blocked category=check-error detail=${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
