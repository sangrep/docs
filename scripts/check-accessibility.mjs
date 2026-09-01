#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import process from 'node:process';

import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright-core';

import { inspectContent } from './check-content.mjs';

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

function browserExecutable() {
  const candidates = [
    process.env.SANGREP_DOCS_CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

function safeFilePath(distRoot, requestPath) {
  const pathname = decodeURIComponent(new URL(requestPath, 'http://127.0.0.1').pathname);
  const relativePath = pathname.endsWith('/')
    ? `${pathname.slice(1)}index.html`
    : pathname.slice(1);
  const candidate = resolve(distRoot, relativePath || 'index.html');
  const candidateRelative = relative(distRoot, candidate);
  if (candidateRelative.startsWith('..') || candidateRelative.includes(`..${sep}`)) return null;
  return candidate;
}

async function startStaticServer(distRoot) {
  const server = createServer(async (request, response) => {
    try {
      const path = safeFilePath(distRoot, request.url ?? '/');
      if (!path || !existsSync(path) || !(await stat(path)).isFile()) {
        response.writeHead(404, {
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'content-type': contentTypes.get(extname(path).toLowerCase()) ?? 'application/octet-stream',
      });
      response.end(await readFile(path));
    } catch {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Static server error');
    }
  });
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveReady);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('static server address unavailable');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function main() {
  const distRoot = resolve('dist');
  const contentRoot = resolve('src/content/docs');
  const executablePath = browserExecutable();
  if (!executablePath) {
    process.stderr.write('accessibility-check: blocked category=browser-unavailable\n');
    process.exitCode = 1;
    return;
  }
  if (!existsSync(distRoot)) {
    process.stderr.write('accessibility-check: blocked category=build-output-missing\n');
    process.exitCode = 1;
    return;
  }

  let server;
  let browser;
  try {
    const { findings, pages } = await inspectContent(contentRoot, distRoot);
    if (findings.length > 0)
      throw new Error('content policy must pass before accessibility inspection');
    const routes = pages
      .filter((page) => page.data.status === 'Released')
      .map((page) => page.route);
    const started = await startStaticServer(distRoot);
    server = started.server;
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: process.platform === 'linux' ? ['--no-sandbox'] : [],
    });
    const violations = [];
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      for (const route of routes) {
        await page.goto(`${started.origin}${route}`, {
          waitUntil: 'networkidle',
        });
        if (viewport.name === 'mobile') {
          const menuButton = page.getByRole('button', { name: 'Menu' });
          if (await menuButton.isVisible()) {
            const initialState = await menuButton.getAttribute('aria-expanded');
            await menuButton.click();
            await page.waitForFunction(() =>
              document.body.hasAttribute('data-mobile-menu-expanded'),
            );
            const openState = await menuButton.getAttribute('aria-expanded');
            await menuButton.click();
            await page.waitForFunction(
              () => !document.body.hasAttribute('data-mobile-menu-expanded'),
            );
            const closedState = await menuButton.getAttribute('aria-expanded');
            if (initialState !== 'false' || openState !== 'true' || closedState !== 'false') {
              violations.push({
                route,
                viewport: viewport.name,
                id: 'mobile-menu-expanded-state',
                impact: 'serious',
                targets: ['button[aria-label="Menu"]'],
              });
            }
          }
        }
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        for (const violation of result.violations) {
          violations.push({
            route,
            viewport: viewport.name,
            id: violation.id,
            impact: violation.impact ?? 'unknown',
            targets: violation.nodes.flatMap((node) => node.target).slice(0, 6),
          });
        }
        const crossedHeadings = await page
          .locator('.sl-markdown-content h2')
          .evaluateAll((headings) =>
            headings
              .filter((heading) => {
                const style = getComputedStyle(heading);
                return style.display === 'inline' && style.borderTopWidth !== '0px';
              })
              .map((heading) => `#${heading.id}`),
          );
        if (crossedHeadings.length > 0) {
          violations.push({
            route,
            viewport: viewport.name,
            id: 'section-divider-layout',
            impact: 'serious',
            targets: crossedHeadings,
          });
        }
      }
      await context.close();
    }
    if (violations.length > 0) {
      for (const violation of violations) {
        process.stderr.write(
          `accessibility-check: blocked category=axe route=${violation.route} viewport=${violation.viewport} rule=${violation.id} impact=${violation.impact} targets=${JSON.stringify(violation.targets)}\n`,
        );
      }
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `accessibility-check: passed routes=${routes.length} viewports=${viewports.length}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `accessibility-check: blocked category=check-error detail=${error.message}\n`,
    );
    process.exitCode = 1;
  } finally {
    await browser?.close();
    if (server) await new Promise((resolveClosed) => server.close(resolveClosed));
  }
}

await main();
