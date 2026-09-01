# Authoring Sangrep Workbench guides

Write for the reviewer or administrator at the moment they need to complete a task, understand a
boundary, or recover safely. Product guides describe what a person can do. They do not restate
implementation architecture, function signatures, schemas, private decisions, or delivery history.

## Choose the route

Place a page under one of these task-oriented roots:

- `start/` — installation, first launch, sign-in, and first-use boundaries;
- `workspaces/` — create, open, close, checkpoint, backup, and workspace state;
- `review/` — evidence review, citations, findings, decisions, and exports;
- `packs/` — install, select, update, remove, and recover parser packs;
- `providers/` — select a provider, understand egress, and recover from provider errors;
- `configuration/` — user- or administrator-controlled product settings;
- `privacy/` — local custody, data movement, consent, and retention;
- `recovery/` — restore or recover without weakening source authority;
- `troubleshooting/` — typed failures and safe next actions; and
- `releases/` — accepted user-visible changes by exact version and platform.

Create a page only when there is real behavior or a real documentation boundary to explain. Empty
category placeholders do not belong in the content collection.

## Add complete metadata

Every Markdown or MDX page must include these fields:

```yaml
title: Create a local workspace
description: Create an encrypted workspace in Sangrep Workbench.
status: Released
platforms:
  - macOS
version: 1.2.0
limitations: Network folders are not supported by this guide.
privacy: Creating the workspace sends no document content off the device.
recovery: If creation is uncertain, inspect the selected target before trying again.
contentType: task
expectedResult: Workspace Home shows the closed workspace and its latest checkpoint.
draft: false
pagefind: true
```

`platforms` accepts `Web`, `macOS`, and `Windows`. `contentType` accepts `overview`, `task`,
`reference`, `release`, and `technical-reference`. A task also requires `expectedResult` and a
numbered list beginning at step 1.

The release fields are coupled:

| Status     | `draft` | `pagefind` | Production route and search |
| ---------- | ------- | ---------- | --------------------------- |
| Released   | `false` | `true`     | Included                    |
| Preview    | `true`  | `false`    | Excluded                    |
| Unreleased | `true`  | `false`    | Excluded                    |

A released product task names the exact accepted Workbench version and platforms. A page about the
documentation system itself may use a documentation version, but its limitations must explicitly say
that it is not a Workbench availability claim.

## Write the task

1. State prerequisites that the reader can verify.
2. Use the exact control name through the entire flow.
3. Number actions in the order they happen.
4. Put the observable success state in `expectedResult`.
5. Explain normal failure branches and the safest recovery action.
6. Keep privacy and egress effects specific to this task.
7. State unsupported combinations without implying future delivery.

Use tabs only for equivalent choices where the reader needs one path. Keep headings sequential, code
blocks copyable, tables compact, and link text meaningful outside its paragraph.

## Keep technical details canonical

Public APIs, CLI behavior, and extension details belong in the
[harness developer documentation](https://sangrep.github.io/harness/). Public schemas and
compatibility rules belong in the
[contracts reference](https://github.com/sangrep/contracts/tree/master/docs).

When a product page genuinely needs one of those references:

- add its exact HTTPS URL as `technicalReference`;
- link that exact URL from the page body; and
- explain the user task without copying the technical reference.

Use `contentType: technical-reference` for a page whose main purpose is routing readers to a
component reference. Exact duplicate page bodies fail the content check unless the duplicate is an
intentional projection with an explicit HTTPS `canonicalSource`.

## Add media safely

Do not commit a screenshot or recording merely because it exists. The media must be approved for
permanent public history, free of credentials, document content, private identifiers, internal Issue
labels, unpublished product composition, and misleading release claims.

Store screenshots under `public/screenshots/` and recordings under `public/recordings/`. Add every
asset to `public/media-manifest.json` with:

- its repository-relative path and kind;
- `status: Released`;
- a public-safe source description;
- its applicable license identifier;
- the exact alt text used by the page; and
- the SHA-256 of the committed bytes.

Reference media with an absolute path such as
`![Workspace Home showing a closed local workspace](/screenshots/workspace-home.png)`. Files larger
than eight megabytes, missing or empty alt text, unlisted assets, mismatched digests, and
non-Released public media fail closed. Prefer no image when an approved, useful image is
unavailable.

## Verify the result

Use Node.js 24 and run:

```bash
npm ci
./scripts/check
```

`./scripts/check` is the single preliminary gate. It runs content and release policy tests, metadata
and link checks, duplicate and media checks, type checking, formatting, the static build,
generated-output inspection, static HTML validation, browser accessibility checks, Gitleaks, and the
public-information boundary scan.

Run `npm run dev` to review Preview and Unreleased pages locally. Run `npm run build` followed by
`npm run preview` to inspect the exact Released-only production output.
