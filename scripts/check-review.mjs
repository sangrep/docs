#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright-core';

import { inspectContent } from './check-content.mjs';

const reviewPort = 43817;
const reviewOrigin = `http://127.0.0.1:${reviewPort}`;
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

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

function expectedStepCount(body) {
  const markdownSteps = body.match(/^\s*\d+\.\s+\S/gm)?.length ?? 0;
  const htmlSteps = body.match(/<li(?:\s[^>]*)?>/gi)?.length ?? 0;
  return markdownSteps + htmlSteps;
}

async function waitForServer(child, output) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('review server exited before becoming ready');
    try {
      const response = await fetch(reviewOrigin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`review server did not become ready: ${output().slice(-500)}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function main() {
  const executablePath = browserExecutable();
  if (!executablePath) {
    process.stderr.write('review-check: blocked category=browser-unavailable\n');
    process.exitCode = 1;
    return;
  }
  const astroBinary = resolve('node_modules/astro/bin/astro.mjs');
  if (!existsSync(astroBinary)) {
    process.stderr.write('review-check: blocked category=dependencies-unavailable\n');
    process.exitCode = 1;
    return;
  }

  let serverOutput = '';
  const reviewServer = spawn(
    process.execPath,
    [astroBinary, 'dev', '--host', '127.0.0.1', '--port', String(reviewPort), '--ignore-lock'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ASTRO_DEV_BACKGROUND: '1',
        ASTRO_TELEMETRY_DISABLED: '1',
        DOCS_REVIEW: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const collectOutput = (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-8_000);
  };
  reviewServer.stdout.on('data', collectOutput);
  reviewServer.stderr.on('data', collectOutput);

  let browser;
  try {
    await waitForServer(reviewServer, () => serverOutput);
    const { findings, pages } = await inspectContent(
      resolve('src/content/docs'),
      resolve('public'),
    );
    if (findings.length > 0) throw new Error('content policy must pass before review inspection');
    const hiddenPages = pages.filter((page) => page.data.status !== 'Released');
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: process.platform === 'linux' ? ['--no-sandbox'] : [],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    await page.goto(reviewOrigin, { waitUntil: 'networkidle' });
    const reviewLinks = new Set(
      await page
        .locator('nav[aria-label="Main"] a[href]')
        .evaluateAll((links) => links.map((link) => new URL(link.href).pathname)),
    );
    const missingNavigation = hiddenPages
      .map((entry) => entry.route)
      .filter((route) => !reviewLinks.has(route));
    if (missingNavigation.length > 0) {
      throw new Error(
        `hidden routes missing from review navigation: ${missingNavigation.join(',')}`,
      );
    }

    let taskSteps = 0;
    for (const entry of hiddenPages) {
      const response = await page.goto(`${reviewOrigin}${entry.route}`, {
        waitUntil: 'networkidle',
      });
      if (!response?.ok()) throw new Error(`review route unavailable: ${entry.route}`);
      const renderedStatus = await page
        .locator('[data-guide-status]')
        .getAttribute('data-guide-status');
      if (renderedStatus !== entry.data.status) {
        throw new Error(`review status mismatch: ${entry.route}`);
      }
      if (!(await page.getByText('This content is a draft', { exact: false }).isVisible())) {
        throw new Error(`draft notice missing: ${entry.route}`);
      }
      if (entry.data.contentType === 'task') {
        const expected = expectedStepCount(entry.body);
        const rendered = await page.locator('.sl-markdown-content ol > li').count();
        if (expected === 0 || rendered !== expected) {
          throw new Error(`task steps did not render faithfully: ${entry.route}`);
        }
        taskSteps += rendered;
      }
      const axe = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
      if (axe.violations.length > 0) {
        const ids = axe.violations
          .map((violation) => violation.id)
          .sort()
          .join(',');
        throw new Error(`review accessibility violation: ${entry.route} rules=${ids}`);
      }
    }
    await context.close();
    process.stdout.write(
      `review-check: passed hidden_routes=${hiddenPages.length} task_steps=${taskSteps}\n`,
    );
  } catch (error) {
    process.stderr.write(`review-check: blocked category=review-surface detail=${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    await stopChild(reviewServer);
  }
}

await main();
