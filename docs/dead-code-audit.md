# Dead-code audit

The repository uses Knip as a review aid for unused internal exports. The
initial adoption is deliberately warning-only: it makes the current backlog
visible in local development and CI without treating an unreviewed static
analysis result as permission to change or delete code.

## Commands

```sh
pnpm dead-code:config
pnpm dead-code:audit
```

The configuration check protects the repository-specific assumptions that
matter most: the configured DHIS2 app entry must match
`d2.config.js#entryPoints.app`, internal package entries must be inspected, and
the public `packages/*/src/index.ts` surface must remain exempt. The audit then
reports export-related findings as warnings and exits successfully. It never
runs Knip's `--fix` option and never deletes code.

## Why warning-only first

Knip builds a reachability graph from entry files. A missed framework entry,
generated consumer, or dynamic import can make a live chain appear unused.
Knip's staged-adoption guidance therefore recommends establishing a trustworthy
graph before promoting individual issue types or workspaces to errors. A fixed
total-issue budget was not adopted: one new finding could replace one resolved
finding while the total stayed under budget, and file-reachability cascades can
change the count without representing an equivalent regression.

The configured graph accounts for:

- the DHIS2 Application Platform app entry declared in `apps/web/d2.config.js`;
- the translation extraction catalog scanned by `d2-app-scripts`;
- pnpm workspace boundaries and package subpath exports;
- Jest setup and module-mapper files consumed through package configuration;
- type-contract files compiled by TypeScript rather than imported at runtime;
- Playwright specs and the custom Oxlint plugin entry.

`packages/*/src/index.ts` files are public source-block APIs. Their exports are
not evidence of dead code merely because this repository has no consumer for
every API, so all export-related issue types are exempt there. Other source
files, including non-root entry files and internal barrels, remain analyzed.

## Reviewing a finding

Review findings one file at a time; never mass-delete or apply `knip --fix`.

1. Confirm the file is reachable from the expected app, package, test, or tool
   entry. If it is not, fix the Knip graph before evaluating its exports.
2. Search for static imports, re-exports, namespace access, configuration
   references, generated consumers, and computed `import()` or `require()`
   paths.
3. Decide whether only the `export` modifier is unnecessary or whether the
   declaration itself is dead. These are different changes.
4. Remove one coherent group, then run the relevant tests, typecheck, build,
   and the Knip audit again. Review the diff normally.
5. Prefer modeling a real entry or consumer over adding an ignore. Add a narrow
   exemption only when the external/framework contract is documented.

Once a workspace and issue type have been reviewed to zero, change that rule
from `warn` to `error` in a dedicated pull request. Promote incrementally rather
than enabling repository-wide enforcement at once.

## Known blind spots

- Computed dynamic import paths cannot always be resolved statically. Add the
  first file in such an import chain to `entry` when one is introduced.
- Frameworks and generators can consume files through configuration or scans.
  The current DHIS2, translation, Jest, TypeScript, Playwright, and Oxlint cases
  are modeled, but new conventions must be added explicitly.
- The generated `apps/web/src/locales` module is intentionally outside the
  reported TypeScript project set. CI generates it before the audit; Knip still
  follows imports into it when present.
- Public consumers outside this repository are unknowable. This is why root
  package `src/index.ts` exports are exempt rather than declared unused.
- Namespace enumeration and reflection can hide symbol-level usage from static
  analysis. Review namespace and computed-property patterns manually.
- Knip focuses on inter-file reachability. Dead branches or declarations used
  only within the same file may require TypeScript, Oxlint, tests, and review to
  identify.

## Sources

- [Knip: adopt gradually](https://knip.dev/guides/adopt-gradually)
- [Knip: configuring project files](https://knip.dev/guides/configuring-project-files)
- [Knip: monorepos and workspaces](https://knip.dev/features/monorepos-and-workspaces)
- [Knip: resolving reported issues](https://knip.dev/guides/handling-issues)
- [Knip: configuration reference](https://knip.dev/reference/configuration)
- [DHIS2 Application Platform configuration reference](https://developers.dhis2.org/docs/app-platform/config/d2-config-js-reference/)
- [Practitioner report: using Knip in a high-traffic repository](https://madelinemiller.dev/blog/knip-dead-code/)
