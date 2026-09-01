#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { gunzipSync } from 'node:zlib';

import { inspectContent } from './check-content.mjs';

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.txt', '.xml']);
const pagefindExtensions = new Set(['.pagefind', '.pf_fragment', '.pf_index', '.pf_meta']);
const maximumExpandedSearchBytes = 8 * 1024 * 1024;

function parseArguments(argv) {
  const options = {
    dist: 'dist',
    contentRoot: 'src/content/docs',
    format: 'text',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`missing value for ${argument}`);
    if (argument === '--dist') options.dist = value;
    else if (argument === '--content-root') options.contentRoot = value;
    else if (argument === '--format') options.format = value;
    else throw new Error(`unknown argument: ${argument}`);
    index += 1;
  }
  if (!['json', 'text'].includes(options.format)) throw new Error('format must be json or text');
  return options;
}

async function filesUnder(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (entry.isFile()) files.push(path);
    }
  }
  await visit(root);
  return files;
}

function outputPathForRoute(distRoot, route) {
  if (route === '/') return join(distRoot, 'index.html');
  return join(distRoot, route.replace(/^\//, ''), 'index.html');
}

function finding(category, path, detail) {
  return { category, path, detail };
}

function hasPattern(html, pattern) {
  return pattern.test(html);
}

function validateHtml(html, relativePath) {
  const findings = [];
  const accessibilityChecks = [
    /<html\b[^>]*\blang=["'][^"']+["']/i,
    /<a\b[^>]*href=["']#[^"']+["'][^>]*>[^<]*skip[^<]*<\/a>/i,
    /<nav\b[^>]*(?:aria-label|aria-labelledby)=["'][^"']+["']/i,
    /<main\b[^>]*>/i,
    /<h1\b[^>]*>/i,
  ];
  if (accessibilityChecks.some((pattern) => !hasPattern(html, pattern))) {
    findings.push(
      finding(
        'html-accessibility',
        relativePath,
        'missing language, skip link, labelled navigation, main, or h1',
      ),
    );
  }
  const guideStatusChecks = [
    /<section\b[^>]*aria-labelledby=["']guide-status-heading["'][^>]*>/i,
    /<h2\b[^>]*id=["']guide-status-heading["'][^>]*>\s*Guide status\s*<\/h2>/i,
    /<dl\b[^>]*data-guide-status=["'](?:Released|Preview|Unreleased)["'][^>]*>/i,
    /<dt\b[^>]*>\s*Status\s*<\/dt>/i,
    /<dt\b[^>]*>\s*Platform\s*<\/dt>/i,
    /<dt\b[^>]*>\s*Version\s*<\/dt>/i,
    /<dt\b[^>]*>\s*Privacy\s*<\/dt>/i,
    /<dt\b[^>]*>\s*Limitations\s*<\/dt>/i,
    /<dt\b[^>]*>\s*Recovery\s*<\/dt>/i,
  ];
  if (guideStatusChecks.some((pattern) => !hasPattern(html, pattern))) {
    findings.push(finding('guide-status', relativePath, 'missing visible guide status metadata'));
  }
  const metadataChecks = [
    /<title>\s*[^<]+\s*<\/title>/i,
    /<meta\b[^>]*name=["']description["'][^>]*content=["'][^"']+["'][^>]*>/i,
    /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/[^"']+["'][^>]*>/i,
  ];
  if (metadataChecks.some((pattern) => !hasPattern(html, pattern))) {
    findings.push(
      finding('html-metadata', relativePath, 'missing title, description, or canonical URL'),
    );
  }
  return findings;
}

function hrefCandidates(html) {
  const values = [];
  const pattern = /\b(?:href|src)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) values.push(match[1]);
  return values;
}

function outputTarget(distRoot, currentHtml, href) {
  const cleanHref = href.split(/[?#]/, 1)[0];
  if (!cleanHref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return null;
  const currentRoute = `/${relative(distRoot, currentHtml)
    .split(sep)
    .join('/')
    .replace(/index\.html$/, '')}`;
  const pathname = href.startsWith('/')
    ? new URL(href, 'https://docs.invalid').pathname
    : new URL(href, `https://docs.invalid${currentRoute}`).pathname;
  const decoded = decodeURIComponent(pathname).replace(/^\//, '');
  const directPath = join(distRoot, decoded);
  if (extname(decoded)) return directPath;
  return join(directPath, 'index.html');
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const distRoot = resolve(options.dist);
    const contentRoot = resolve(options.contentRoot);
    if (!existsSync(distRoot)) throw new Error('build output does not exist');
    const { findings: contentFindings, pages } = await inspectContent(contentRoot, distRoot);
    if (contentFindings.length > 0)
      throw new Error('content policy must pass before build inspection');
    const publicPages = pages.filter((page) => page.data.status === 'Released');
    const hiddenPages = pages.filter((page) => page.data.status !== 'Released');
    const findings = [];

    for (const page of publicPages) {
      if (!existsSync(outputPathForRoute(distRoot, page.route))) {
        findings.push(finding('missing-released-route', page.relativePath, page.route));
      }
    }
    for (const page of hiddenPages) {
      if (existsSync(outputPathForRoute(distRoot, page.route))) {
        findings.push(finding('hidden-route-leak', page.relativePath, page.route));
      }
    }

    const files = await filesUnder(distRoot);
    const textByPath = new Map();
    for (const path of files) {
      const extension = extname(path).toLowerCase();
      if (textExtensions.has(extension)) {
        textByPath.set(path, await readFile(path, 'utf8'));
      } else if (pagefindExtensions.has(extension)) {
        const expanded = gunzipSync(await readFile(path), {
          maxOutputLength: maximumExpandedSearchBytes,
        });
        textByPath.set(path, expanded.toString('utf8'));
      }
    }

    for (const hiddenPage of hiddenPages) {
      for (const [path, text] of textByPath) {
        if (text.includes(hiddenPage.route) || text.includes(hiddenPage.data.title)) {
          findings.push(
            finding(
              'hidden-content-leak',
              relative(distRoot, path).split(sep).join('/'),
              hiddenPage.route,
            ),
          );
        }
      }
    }

    const htmlFiles = files.filter((path) => extname(path).toLowerCase() === '.html');
    for (const path of htmlFiles) {
      const relativePath = relative(distRoot, path).split(sep).join('/');
      if (relativePath !== '404.html')
        findings.push(...validateHtml(textByPath.get(path), relativePath));
      for (const href of hrefCandidates(textByPath.get(path))) {
        const target = outputTarget(distRoot, path, href);
        if (target && !existsSync(target))
          findings.push(finding('broken-build-link', relativePath, href));
      }
    }

    if (findings.length > 0) {
      for (const value of findings) {
        process.stderr.write(
          `build-check: blocked category=${value.category} path=${value.path} detail=${value.detail}\n`,
        );
      }
      process.exitCode = 1;
      return;
    }
    const report = {
      hiddenRoutes: hiddenPages.length,
      htmlPages: htmlFiles.length,
      publicRoutes: publicPages.length,
    };
    if (options.format === 'json') process.stdout.write(`${JSON.stringify(report)}\n`);
    else
      process.stdout.write(
        `build-check: passed public_routes=${report.publicRoutes} hidden_routes=${report.hiddenRoutes} html_pages=${report.htmlPages}\n`,
      );
  } catch (error) {
    process.stderr.write(`build-check: blocked category=check-error detail=${error.message}\n`);
    process.exitCode = 1;
  }
}

await main();
