# Contributor and agent guide

## Purpose

This repository owns the Docs component: Released Sangrep Workbench product documentation and
publication tooling.

## Public information boundary

Assume every branch, commit, Issue, pull request, review, workflow log, artifact, document, and
agent instruction can become permanently public. Work only from repository-local public context. Do
not mention private repositories, parents, roadmaps, task identifiers, worktrees, local paths,
provider records, customer material, credentials, or unreleased product composition.

## Working agreement

1. Read README.md, CONTRIBUTING.md, SECURITY.md, and the assigned public Issue.
2. Keep changes focused and repository-local; consume other components only as released artifacts.
3. Do not add source copied from another repository without reviewed public provenance.
4. Follow `AUTHORING.md` and `RELEASE_POLICY.md`; never promote development evidence into a product
   claim.
5. Do not add generated files unless their generator and drift check are included.
6. Run `./scripts/check` before pushing or requesting review.
7. Record exact tested and untested scope. Do not claim support or release from a passing build.
8. Use a private security report for vulnerabilities.

## Repository map

- `.github/` — contribution forms, review ownership, and scoped CI.
- `src/content/docs/` — classified product guides; only Released pages enter production output.
- `src/components/` and `src/styles/` — renderer-owned presentation and metadata UI.
- `tests/` — content and generated-output policy tests.
- `scripts/` — the preliminary check, release filter, accessibility, and public-boundary audits.

## Dependency direction

No editable installs, submodules, source-tree imports, or hidden cross-repository credentials. Use
versioned artifacts with digests and compatibility declarations.

## Documentation

Implementation facts stay beside this component. User-facing product behavior belongs in its
canonical product documentation. Internal decision history does not enter this repository.
