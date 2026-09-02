# Sangrep Workbench documentation

Task-focused product documentation with explicit version, platform, privacy, limitation, and
recovery boundaries.

This repository is in private prepublication review. Its production build currently publishes only
documentation-status guidance; it contains no Released Sangrep Workbench product guide and makes no
installer, format-support, platform-support, product-release, or public-availability claim.

## Start here

- Use Node.js 24, then run `npm ci` and `./scripts/check`.
- Read [AUTHORING.md](AUTHORING.md) before writing or promoting a guide.
- Read [RELEASE_POLICY.md](RELEASE_POLICY.md) before changing page status or repository visibility.
- Read [DEPLOYMENT.md](DEPLOYMENT.md) before uploading a route-free hosted preview.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), never a public Issue.
- See [SUPPORT.md](SUPPORT.md) for public questions and support boundaries.

## Preview locally

```bash
nvm use
npm ci
npm run dev
```

The local review server includes Preview and Unreleased pages. To inspect the exact production
surface instead:

```bash
npm run build
npm run preview
```

The production build contains only Released routes, navigation, and search entries.

## Scope

`sangrep/docs` owns Sangrep Workbench installation, onboarding, workspace, review, privacy,
provider, pack, configuration, recovery, troubleshooting, and release guidance. Implementation and
API facts remain with their public component references; this repository links to those references
instead of copying them.

## Repository map

- `src/content/docs/` — portable Markdown and MDX product guides.
- `src/components/` and `src/styles/` — the standalone Starlight renderer and release lens.
- `public/media-manifest.json` — digest-bound inventory for approved public screenshots and
  recordings.
- `tests/` — behavior tests for content and generated-output policy.
- `scripts/` — the single check entrypoint and fail-closed publication audits.
- `AUTHORING.md` — content, metadata, media, and canonical-link contract.
- `RELEASE_POLICY.md` — status transitions, production filtering, publication, and rollback.
- `DEPLOYMENT.md` — route-free Cloudflare preview procedure and production exclusions.

## License status

Documentation prose is licensed under CC-BY-4.0, renderer and verification code under Apache-2.0,
and designated Sangrep brand content under LicenseRef-Sangrep-Brand-Content. See [LICENSE](LICENSE),
[LICENSE_MAP.json](LICENSE_MAP.json), [TRADEMARKS.md](TRADEMARKS.md), and
[PROVENANCE.md](PROVENANCE.md).

The repository remains private until its copyright, provenance, license-text, secret,
public-boundary, exact-head review, preview, and hosted-metadata acceptance all pass.
