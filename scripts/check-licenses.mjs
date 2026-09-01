#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const requiredLicenseFiles = [
  'LICENSE',
  'NOTICE',
  'LICENSE_MAP.json',
  'LICENSES/Apache-2.0.txt',
  'LICENSES/CC-BY-4.0.txt',
  'LICENSES/LicenseRef-Sangrep-Brand-Content.txt',
  'PROVENANCE.md',
  'TRADEMARKS.md',
];
const allowedClassifications = new Set([
  'Apache-2.0',
  'CC-BY-4.0',
  'License-Notice',
  'LicenseRef-Sangrep-Brand-Content',
  'Per-public-media-manifest',
]);
const standardLicenseDigests = new Map([
  ['LICENSES/Apache-2.0.txt', '0ffddef9e48f8a09aed5caf2d44f7ba1c1be2d9b8e0a6f693b1635b2d5566645'],
  ['LICENSES/CC-BY-4.0.txt', '50a0385d4606ed02586ea82f3307d8835cf2e76f7c2b70f5e2f340bd4a1e9fb3'],
]);

function matches(pattern, path) {
  if (pattern === '**') return true;
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  if (pattern.startsWith('**/*.')) return path.endsWith(pattern.slice(4));
  return path === pattern;
}

function repositoryPaths() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'buffer' },
  );
  return output.toString('utf8').split('\0').filter(Boolean).sort();
}

function blocked(category, detail) {
  process.stderr.write(`license-check: blocked category=${category} detail=${detail}\n`);
  process.exitCode = 1;
}

for (const path of requiredLicenseFiles) {
  if (!existsSync(path)) blocked('missing-license-file', path);
}
for (const [path, expectedDigest] of standardLicenseDigests) {
  if (!existsSync(path)) continue;
  const normalized = readFileSync(path, 'utf8').split(/\s+/).filter(Boolean).join(' ');
  const actualDigest = createHash('sha256').update(normalized).digest('hex');
  if (actualDigest !== expectedDigest) blocked('license-text-drift', path);
}

let licenseMap;
try {
  licenseMap = JSON.parse(readFileSync('LICENSE_MAP.json', 'utf8'));
} catch {
  blocked('invalid-license-map', 'unreadable-json');
}

if (
  licenseMap?.schemaVersion !== 'sangrep.license-map.v1' ||
  !Array.isArray(licenseMap?.rules) ||
  licenseMap.rules.length === 0
) {
  blocked('invalid-license-map', 'schema');
} else {
  for (const rule of licenseMap.rules) {
    if (
      !Array.isArray(rule.patterns) ||
      rule.patterns.length === 0 ||
      !rule.patterns.every((pattern) => typeof pattern === 'string' && pattern.length > 0) ||
      !allowedClassifications.has(rule.license)
    ) {
      blocked('invalid-license-map', 'rule');
    }
  }
  if (
    licenseMap.rules.at(-1)?.patterns?.length !== 1 ||
    licenseMap.rules.at(-1).patterns[0] !== '**'
  ) {
    blocked('invalid-license-map', 'catch-all-order');
  }

  const counts = new Map();
  for (const path of repositoryPaths()) {
    const rule = licenseMap.rules.find((candidate) =>
      candidate.patterns.some((pattern) => matches(pattern, path)),
    );
    if (!rule) {
      blocked('unclassified-path', path);
      continue;
    }
    counts.set(rule.license, (counts.get(rule.license) ?? 0) + 1);
  }
  if (process.exitCode !== 1) {
    const renderedCounts = [...counts]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([license, count]) => `${license}:${count}`)
      .join(',');
    process.stdout.write(`license-check: passed classifications=${renderedCounts}\n`);
  }
}
