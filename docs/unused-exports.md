# Unused export analysis

## Outcome

Oxlint 1.79.0 cannot enforce that an exported function or type has a caller in
another repository file. Its `no-unused-vars` rule deliberately treats an
export as a use, and Oxlint has no project-wide unused-export rule. TypeScript's
`noUnusedLocals` behaves the same way for exported declarations.

The closest viable companion is Knip. Run the focused audit with:

```sh
pnpm audit:exports
```

This command is intentionally separate from `pnpm lint` while the existing
findings are reviewed. Do not use `knip --fix` on an unreviewed report.

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

## Representative audit

On 2026-08-24, the configured default audit reported 126 candidates: 79 value
exports and 47 exported types. Examples include:

- `PROGRAM_METADATA_FIELDS`, exported but referenced only in its defining file;
- `findField`, exported but called only inside `savedListNormalization.ts`;
- unused internal barrel edges such as `visibleFiltersForConfiguration`;
- `valueTypeRegistry`, exported but read only inside `valueTypes.ts`.

The initial unconfigured run also reported `OrganisationUnitPicker`, despite it
being rendered by the app. Declaring `AppWrapper.tsx` as the app entry removed
that false positive. A comparison production run found 31 additional
candidates hidden by test consumers, including `fetchWorkingListPage` and
`getInitialColumnDialogOrder`.

These results demonstrate why the audit should be adopted in two phases:

1. Review and reduce the existing baseline without bulk auto-fixing.
2. Once the reviewed default audit is clean, add `pnpm audit:exports` to CI so
   new statically unused internal exports fail the build.

Authoritative references:

- [Oxlint `no-unused-vars`](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-unused-vars.html)
- [Knip unused exports](https://knip.dev/typescript/unused-exports)
- [Knip entry exports and workspace configuration](https://knip.dev/reference/configuration)
- [Knip production mode](https://knip.dev/features/production-mode)
- [Knip issue handling and dynamic-import limitations](https://knip.dev/guides/handling-issues)
