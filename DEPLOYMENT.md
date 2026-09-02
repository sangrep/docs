# Route-free documentation preview

The Cloudflare Worker in this repository exists only to produce an inspectable static preview. Its
checked-in policy requires the dedicated `sangrep-docs-preview` worker, a workers.dev preview URL,
version preview URLs, an empty route list, and no environments, bindings, variables, triggers,
custom domains, or production configuration.

## Upload a reviewed preview

Freeze one exact commit, require its local repository check, required pull-request CI, independent
review, and hosted-metadata audit, then authenticate Wrangler through its normal secure flow. From
that exact clean checkout, run:

```sh
npm ci --ignore-scripts
npm run preview:upload
```

The command rebuilds `dist/`, runs the preview policy and a Wrangler dry run, and uploads a new
version with the `review` preview alias. It does not deploy that version to a production route.
Record the version identifier and versioned URL outside git.

Inspect every Released route at desktop and mobile widths. Exercise the mobile menu, public search,
links, headers, and keyboard navigation; run an accessibility scan; and confirm Preview and
Unreleased routes remain unavailable. A preview is documentation evidence only. It does not change
DNS, a custom domain, repository visibility, Sangrep Workbench release state, or support claims.

## Production remains out of scope

Do not add a route, custom domain, production environment, or deployment command to this repository
as part of preview delivery. Publication requires its own accepted destination Issue, final hosted
audit, explicit visibility authority, anonymous post-publication probes, and immediate rollback on
any mismatch.
