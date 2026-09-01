# Documentation release policy

This repository publishes only guidance that matches explicitly accepted Sangrep Workbench behavior.
A documentation build, preview, screenshot, merged implementation, or passing test does not by
itself establish a product release, supported format, supported platform, or public availability.

## Page states

- **Preview** describes a public-safe experience that is incomplete or still under review. It is
  visible only in source and the local review server.
- **Unreleased** describes complete behavior verified in a development build that has not passed
  packaged-release acceptance. It is visible only in source and the local review server.
- **Released** describes behavior accepted for the exact version and platforms named on the page.
  Only this state is eligible for production routes, navigation, and search.

Preview and Unreleased pages must set `draft: true` and `pagefind: false`. Released pages must set
`draft: false` and `pagefind: true`. The content schema and production-output audit both enforce the
mapping.

## Promote a page to Released

Before changing a product page to Released, record evidence that:

1. the matching packaged Workbench behavior has explicit release acceptance;
2. the page names the exact version and each accepted platform;
3. its steps and expected result match the accepted user flow;
4. privacy, data-egress, limitations, failure, and recovery text matches that same authority;
5. every referenced screenshot or recording is approved, inventoried, licensed, and digest-bound;
6. every technical detail links to its canonical public component reference; and
7. the page passes the complete repository check at the proposed exact head.

Do not promote a page from a design, representative fixture, development screenshot, CI result, or
source-only implementation. If acceptance is narrower than the page, narrow the page first.

## Production filtering

The production build uses Starlight's draft exclusion and a repository-owned independent audit:

- only Released source pages may produce static routes;
- every Released page must produce a route;
- Preview and Unreleased routes and titles must not appear anywhere in generated HTML, assets, or
  the Pagefind search index;
- a Released page may not link to a hidden page; and
- navigation is constructed from Released groups in production and expands to review groups only in
  the local review server.

The build fails closed when the source policy and generated output disagree.

## Repository publication gate

The repository stays private until all of these conditions are recorded against one exact head:

1. `./scripts/check` passes from a clean dependency install;
2. maintainers inspect the Released-only static preview on desktop and mobile;
3. an independent reviewer approves the exact head and all review threads are resolved;
4. required pull-request CI is green on that head;
5. the complete hosted metadata inventory passes the public-information scan;
6. the repository's publication Issue records explicit acceptance of its measured outcome; and
7. license texts, notices, provenance, trademarks, and file classifications are accepted for
   publication.

Only then may a maintainer change repository visibility. After the change, verify an unauthenticated
clone, repository API response, and browser load. Re-privatize immediately if the content, metadata,
default branch, documentation host, or unauthenticated result differs from the accepted evidence.

## Roll back documentation

If a Released guide overstates behavior or discloses unsafe material:

1. remove it from production navigation by returning it to Preview or Unreleased;
2. rebuild and verify that its route and search entries are absent;
3. correct any affected release note or redirect;
4. use private vulnerability reporting when the problem is security-sensitive; and
5. publish corrected guidance only after the relevant acceptance is re-established.

Removing a page from navigation does not remove it from Git history. Public-information review must
therefore happen before the first commit, not only before deployment.
