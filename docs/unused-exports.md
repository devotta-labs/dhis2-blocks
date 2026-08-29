# Knip dead-code analysis

## Outcome

Oxlint 1.79.0 cannot enforce that an exported function or type has a caller in
another repository file. Its `no-unused-vars` rule deliberately treats an
export as a use, and Oxlint has no project-wide unused-export rule. TypeScript's
`noUnusedLocals` behaves the same way for exported declarations.

The closest viable companion is Knip. Run the CI-equivalent audit with:

```sh
pnpm dead-code:audit
```

The command invokes the pinned Knip version directly. Every configured issue
type, including circular imports, has error severity; configuration and tag
hints are errors as well. There is no issue budget, committed baseline, or
report filter, so any finding makes the command and its dedicated CI job fail.
Do not use `knip --fix` on an unreviewed report. Run `pnpm audit:exports` when
only the export/type subset is useful during investigation.

## Scope and public API policy

Knip builds a repository module graph, so it can follow direct imports,
re-exports, and workspace package imports. The configuration declares the
DHIS2 app's actual `src/AppWrapper.tsx` entry because Knip does not discover
that framework convention by default.

For the Working List package, `includeEntryExports` checks exports from package
subpaths such as `src/development.ts`. The `ignoreIssues` entry for
`src/index.ts` is deliberate: the root index is the library's public API and
external consumers may use exports that have no caller in this repository.
Apply the same narrow `src/index.ts` exemption when another library workspace
is added; do not exempt internal barrels wholesale.

An unused barrel re-export is reported independently from its originating
declaration. That is useful: remove the unused barrel edge even when the
originating symbol has another direct consumer.

## Tests and production consumers

The default audit includes tests. An export used only by a test therefore has a
real repository consumer and is not reported. To find test-only seams that are
unused by shipped code, run a separate production audit after marking the
production `entry` and `project` patterns with Knip's `!` suffix and validating
the resulting graph. Production mode is a stricter review signal, not a
replacement for the default audit.

## Limitations and exceptions

This is static analysis, not a proof that an export has no runtime consumer.
Computed dynamic imports, reflection, generated code, framework conventions,
string-key registry lookup, and CommonJS namespace/member access can escape the
graph. Conversely, passing an imported namespace as a value can conservatively
mark all of its members used.

Before removing a reported export:

1. Confirm its file is reachable from the configured entries.
2. Search manifests, registries, generated code, and string-based consumers.
3. Confirm it is not part of the root public API or another documented external
   contract.
4. Prefer teaching Knip about a missing entry or plugin. Use a targeted
   `@public` annotation only for a genuine dynamic or external contract.

Cross-package imports are analyzed because pnpm workspaces and package
`exports` are part of Knip's graph. A missing or computed consumer outside that
graph remains an explicit review responsibility.

## Reviewed cleanup

On 2026-08-24, the expanded audit initially reported two unused files, 80 value
exports, 47 exported types, two unlisted root imports, and one runtime cycle.
Direct usage analysis removed or internalized the high-confidence findings,
including:

- the unregistered Effect-specific Oxlint rule files;
- unused saved-list query and mutation option factories;
- unused schema compositions, helpers, constants, and barrel edges;
- export modifiers on declarations used only inside their defining modules.

The final runtime cycle between `registry/systemFilters.ts` and
`registry/valueTypes.ts` was removed by making the system-filter module depend
directly on the lower-level date definition and value-type contracts. The
assembled value-type registry still consumes the system-filter API, but the
dependency is now one-way. Knip reports zero findings, so plain Knip is the CI
gate and no baseline machinery remains.

Authoritative references:

- [Oxlint `no-unused-vars`](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-unused-vars.html)
- [Knip unused exports](https://knip.dev/typescript/unused-exports)
- [Knip CI guidance](https://knip.dev/guides/using-knip-in-ci)
- [Knip entry exports and workspace configuration](https://knip.dev/reference/configuration)
- [Knip production mode](https://knip.dev/features/production-mode)
- [Knip issue handling and dynamic-import limitations](https://knip.dev/guides/handling-issues)
