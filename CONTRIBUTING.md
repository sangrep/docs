# Contributing

Thank you for helping improve this component.

## Before you start

Small fixes, tests, examples, documentation, and accessibility improvements may go directly to a
pull request. New API, protocol, security, licensing, or architecture behavior starts with a
self-contained public Issue and maintainer approval. Never include private project context,
credentials, customer material, or unreleased product details.

## Local check

1. Install Node.js 24 and run `npm ci`.
2. Read [AUTHORING.md](AUTHORING.md) and [RELEASE_POLICY.md](RELEASE_POLICY.md).
3. Create a focused branch with a public-safe name.
4. Make one bounded change.
5. Run `./scripts/check`.
6. Open a pull request using the repository template.

Use `npm run dev` for the review-only surface and `npm run build && npm run preview` for the
Released-only production surface. A status change needs evidence for the exact version, platforms,
privacy effects, limitations, and recovery behavior it claims.

Commits use `type(scope): summary`. Explain the public problem, verification, limitations, and
security effects. Security findings follow [SECURITY.md](SECURITY.md).

## Licensing

Contributions are accepted under the path classification in [LICENSE_MAP.json](LICENSE_MAP.json). Do
not add third-party material without its exact provenance and license classification. Brand content
and public media require the explicit classifications described in [AUTHORING.md](AUTHORING.md).
