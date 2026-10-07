# Vendored anti-slop provenance

- Source: https://github.com/dmmulroy/anti-slop
- Incoming revision: `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`
- Original upstream revision: `6d538555cb151d4121ed51a27db81890eacf8ae9`
- Installed paths: `index.ts`, `rules/`, `shared/`, and `vendor/` in this directory.

The original revision was verified byte-for-byte against all 21 TypeScript
files introduced in repository commit `0d7b90a`. The update uses a three-way
merge against that snapshot and preserves the cleanup from `a746f52`.

## Intentional local differences

- The Effect plugin remains omitted. It was previously removed, and no
  workspace declares Effect as a direct dependency.
- `WideningTargetKind` remains private and the unused
  `isPopulatedObjectExpression` helper remains removed.
- `package.json` retains the repository's private ESM declaration.
- The root MIT license and the ESLint Stylistic license and provenance are
  included. Stylistic's source is kept unchanged; Knip excludes only unused
  exported types in its bundled `padding-line-options.d.ts` declaration.
- Upstream generic RuleTester suites are included, although the upstream
  installer normally omits tests. `test.mjs` and `tsconfig.json` integrate
  testing and production-rule typechecking into this repository's checks.

All generic upstream source has been reconciled. Existing rule severities,
options, plugin paths, and ignores remain unchanged. The host approved enabling
`no-array-filter-map`, `no-reduce-accumulator-copy`, and
`require-readable-spacing` at error severity, together with native
`oxc/no-accumulating-spread`. The existing exact dependency pair remains
`oxlint@1.79.0` and `@oxlint/plugins@1.79.0`.

## Verification

Run `pnpm test:lint-rules` for all 19 generic rule suites, including CLI
coverage for comment attachment, multiple files, and repeatable spacing fixes.
Run `pnpm typecheck:lint-rules` for the merged production source. Both checks
also run through the existing root `test` and `typecheck` commands.

Before applying the update, the previous installation was copied to
`/private/tmp/dhis2-blocks-anti-slop-backup-20261007` on the installing host.
