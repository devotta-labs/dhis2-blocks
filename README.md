# DHIS2 blocks

This repository is a pnpm and Turborepo monorepo for reusable DHIS2 UI blocks
and the applications used to develop them.

## Workspace layout

```text
apps/
  web/                  DHIS2 wrapper and component demo application
  docs/                 Vite documentation site with live block previews
packages/
  blocks/
    context-selector/   Capture-style controlled context-selector primitives
    observation-cards/  Read-only trend and latest-value cards for tracked entities
    ui/                 Shared DHIS2-styled shadcn primitives and theme
    working-list/       Canonical Working List source and registry manifest
e2e/                    Real-DHIS2 Playwright coverage
scripts/e2e/            Real-DHIS2 environment orchestration
scripts/docs/           Documentation site backend lifecycle
```

The web application depends on the private block workspaces through pnpm's
`workspace:*` protocol. Each workspace package resolves directly to its source
entry point, so the demo, tests, and production application build all exercise
the same canonical source.

## Setup

```sh
pnpm install
```

## Development application

```sh
pnpm start
```

This starts the DHIS2 custom wrapper from `apps/web`. Working List source
changes receive hot updates without a separate library build. By default the
DHIS2 Application Platform opens the application at
[http://localhost:3000](http://localhost:3000).

The interactive Context Selector primitive showcase is available at
`#/context-selector-showcase` and from the link at the bottom of the demo.

The deployable application bundle is built with:

```sh
pnpm build
```

The DHIS2 application output is written below `apps/web/build`.

## Context Selector block

The Context Selector is a source-installed, Capture-style composition layer for
the application context row. Install it from the GitHub registry in a project
with Tailwind CSS enabled and a valid shadcn `components.json` configuration:

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/context-selector
```

Import the installed source through the project's configured components alias:

```tsx
import {
    ClearSelections,
    ContextSelector,
    EnrollmentSelector,
    EventSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    StageSelector,
} from '@/components/context-selector'
```

`ContextSelector` owns the row's Capture-compatible layout, styling, and
semantics. Its children are independently composable controlled controls. The
host supplies all option data, selected values, availability state, popup
content, and callbacks; it also chooses which controls render and in what
order. The block does not fetch data, synchronize a router or URL, own workflow
state, or decide when progressive disclosure advances.

Compose `ClearSelections` wherever the row-wide clear action belongs and pass
its controlled `onClear` and `disabled` props directly.

A program-first application can initially render only
`ProgramSelector`, then add organisation-unit, enrollment, stage, and event
children as its own context policy makes them relevant. All values, direct
callbacks, and metadata-derived labels are supplied by the host.

## Working List block

The Working List is distributed to consumers as a source registry block.
Installation copies its production source and required dependencies into the
consumer repository, where the block can be edited in place. The installed
source entry point provides the documented compound component and hooks.

Install it from the GitHub registry in a project with Tailwind CSS enabled and
a valid shadcn `components.json` configuration. The installer uses the
configured `aliases.components` directory as its target:

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/working-list
```

Import the installed source through the project's components alias:

```tsx
import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from '@/components/working-list'
```

The installed components own their styling through Tailwind utility classes;
the block does not require a separate stylesheet import. Adjust the import path
above if the project's components alias differs from `@/components`.

The install also pulls in the shared UI primitives the block uses, copied to
`components/dhis2/ui/` (never `components/ui/`), plus the `dhis2-theme` item.
The theme is namespaced (`bg-dhis2-primary`, `border-dhis2-input`,
`rounded-dhis2-sm`, and so on) and does not override Tailwind's defaults, so it
does not restyle the rest of the host application.

Render `WorkingList` beneath the DHIS2 app-runtime provider and a TanStack
`QueryClientProvider`. The minimal complete composition is:

```tsx
<WorkingList programId={programId} orgUnitId={orgUnitId}>
    <WorkingListViewSwitcher />

    <WorkingListToolbar>
        <WorkingListColumnSelector />
        <WorkingListFilterControls />
        <WorkingListToolbarActions />
    </WorkingListToolbar>

    <WorkingListTable onRowClick={openRecord} />
</WorkingList>
```

View selection and pagination are uncontrolled by default. `WorkingList`
starts with the generated default view, page 1, and 15 rows per page. Use
`defaultViewId` and `defaultPagination` to change those initial values. Optional
change callbacks observe locally managed changes:

```tsx
<WorkingList
    programId={programId}
    orgUnitId={orgUnitId}
    defaultViewId={initialViewId}
    defaultPagination={{ page: 1, pageSize: 25 }}
    onViewChange={persistRecentView}
    onPaginationChange={persistRecentPage}
>
    {/* composition above */}
</WorkingList>
```

Control either state independently when it belongs in a URL, router, or parent
store. A controlled value must include its callback:

```tsx
<WorkingList
    programId={programId}
    orgUnitId={orgUnitId}
    viewId={viewId}
    onViewChange={setViewId}
    pagination={pagination}
    onPaginationChange={setPagination}
>
    {/* composition above */}
</WorkingList>
```

`WorkingListViewSwitcher`, `WorkingListToolbar`, and `WorkingListTable` own safe
localized accessible names. Structural components forward native element props
and `className` for application-specific labeling and layout. `onRowClick` is
optional: without it rows are static; providing it adds mouse and keyboard row
opening. `WorkingListTable` also accepts
`dataQualityMode="hidden" | "highlighted"`.

The public API intentionally exposes only the flat root-prefixed composition
shown above. The earlier compound members and saved-list-named root props are
not supported.

`WorkingList` defaults its instance lifetime to `programId`, so changing the
program resets its uncontrolled state. When rendering multiple working lists,
use React's reserved `key` to give each instance a stable identity:

```tsx
<WorkingList key={workingListKey ?? programId} {...props} />
```

A supplied React key overrides the outer instance identity; changing it replaces
that instance even when `programId` stays the same.

The private block workspace packages remain only as the repository's canonical
development and test harnesses. They are not compiled or publishable consumer
packages.

The root `registry.json` is the public registry entry point. It owns global
metadata and composes each package-owned registry manifest through shadcn's
`include` mechanism. Paths declared by a package manifest are relative to that
package.

### Registry development

This is a [GitHub source registry](https://ui.shadcn.com/docs/registry/github):
consumers install straight from the repository. There is no registry server or
generated JSON to deploy. The package manifests use shadcn's documented
[`include`](https://ui.shadcn.com/docs/registry/registry-json#include),
[`registryDependencies` and target placeholders](https://ui.shadcn.com/docs/registry/registry-item-json).
Keep full `devotta-labs/dhis2-blocks/<item>` addresses for same-repository
dependencies; bare names such as `button` refer to the upstream shadcn registry.

```sh
pnpm registry:validate # official CLI: schemas, includes and source-file existence
pnpm registry:build    # official CLI: optional local artifacts in dist/registry
pnpm registry:check    # validate, build, install, typecheck and bundle fresh consumers
```

Development and CI use the lockfile-pinned `shadcn` CLI. The install check uses
the CLI's supported local JSON files, without an HTTP server. It rewrites only
same-repository `registryDependencies` in temporary build artifacts, so those
items come from the checkout being tested, not the default branch.
GitHub `#ref` values are **not inherited** by dependencies; adding a branch ref
to an install command alone is not enough to test an unmerged dependency graph.

After editing UI primitives or tokens, run
`pnpm --filter @dhis2-blocks/ui registry:write` and commit the updated manifest.
The small UI manifest generator remains because `shadcn build` embeds declared
files but does not infer dependencies or convert our shared theme stylesheet
into `cssVars.theme`. It uses TypeScript and PostCSS to read those sources and
shadcn's schema types; the generated manifest is checked for drift in tests.

## UI primitives

The shared DHIS2-styled shadcn primitives live in `packages/blocks/ui` and are
published as one registry item per file, so a project can install only what it
needs. They install to `components/dhis2/ui/` under the configured
`aliases.components` directory, keep the standard shadcn file and export names,
and depend on the `dhis2-theme` item, which is installed automatically:

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/button
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/dialog
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/dhis2-theme
```

Available items: `alert`, `alert-dialog`, `button`, `checkbox`, `cn`,
`combobox`, `dhis2-theme`, `dialog`, `dropdown-menu`, `field`, `input`,
`input-group`, `label`, `popover`, `portal-root`, `select`, `separator`,
`spinner`, `switch`, `table`, `textarea`, `toggle`, `toggle-group`, and
`tooltip`. Items that import siblings (for example `combobox` imports `select`
and `input-group`) install them too.

Every design token is namespaced (`--color-dhis2-*`, `--radius-dhis2-*`,
`--shadow-dhis2-*`, `--font-dhis2`), so utilities such as `bg-dhis2-primary` or
`text-dhis2-grey-700` coexist with the host application's own Tailwind theme
and never replace it. Run `pnpm registry:check` to verify the published items
install and build in a throwaway consumer app.

## Documentation site

`apps/docs` is a Vite + React 18 catalog of MDX pages and executable examples
in the style of the shadcn documentation. Prose and code tabs render without
a backend; live previews reach a real DHIS2 instance through a
same-origin `/dhis2` proxy and are hosted by the official
`@dhis2/app-adapter`. The proxy injects the published `admin`/`district`
demo credentials into every upstream request by default, so previews load
authenticated with no sign-in dialog — override via
`DOCS_DHIS2_USERNAME`/`DOCS_DHIS2_PASSWORD`, or set
`DOCS_DHIS2_ANONYMOUS=1` to pass requests anonymously.

Run a seeded local backend (pinned to DHIS2 42 by default) and start the site:

```sh
pnpm docs:up       # seed and start DHIS2 on http://127.0.0.1:58080
pnpm dev:docs      # serve the docs on http://localhost:3002
```

`pnpm docs:up` is a no-op when the docs backend is already running. Supported
backend versions match the e2e matrix: `pnpm docs:up:41`, `pnpm docs:up:43`,
and `pnpm docs:up:dev`. The docs backend uses a dedicated Compose project
(`dhis2-blocks-docs-<version>`), so e2e cleanup cannot tear it down.

`pnpm docs:down` stops the backend and keeps its data; `pnpm docs:reset`
destroys the volumes and seeds a clean instance.

PostgreSQL data is stored in a project-scoped named volume. Existing stacks
created before this volume was added need a reset, or a manual copy of their
anonymous database volume if local changes must be preserved.

Point the site at an existing development instance instead:

```sh
DOCS_DHIS2_URL=https://play.im.dhis2.org/dev pnpm dev:docs
```

For a production build, `pnpm build:docs` emits a static bundle to
`apps/docs/dist`. The same `/dhis2` proxy then has to be provided by the
host: either run the bundled Node server (`pnpm serve:docs`, honoring
`DOCS_PORT` and `DOCS_DHIS2_URL`), or terminate the `/dhis2` prefix on any
standard reverse proxy (nginx, Caddy, Traefik) in front of the static files.

The site is written for developers and coding agents installing the blocks
into their own projects; repository setup like the commands above belongs in
this README, not on the site.

Pages are MDX documents under `apps/docs/src/pages` registered in
`src/navigation.ts` and `src/App.tsx`. Each example is a single component
under `src/examples` registered in `src/examples/registry.ts`; the Code tab
shows the same source the preview executes, so examples import blocks from
`@/components/<block>` as an installed project would. Examples marked `live`
are wrapped in the app-adapter host at `/preview/<slug>`.

`pnpm docs:e2e` runs the docs Playwright suite (`playwright.docs.config.ts`):
catalog browsing without a backend and live Working List
filtering, sorting, pagination, event mode, and saved-view persistence.

## Observation Cards block

The Observation Cards block shows a tracked entity's latest readings and trends
as read-only cards. Install it from the GitHub registry in a project with
Tailwind CSS enabled and a valid shadcn `components.json` configuration:

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/observation-cards
```

Call `useTrackedEntityObservations` once beneath the DHIS2 app-runtime and
TanStack Query providers, then pass `observations.get(dataElementId)` to each
`TrendCard` or `LatestValueCard`. See
[the block's README](packages/blocks/observation-cards/README.md) for usage and
props.

## Quality checks

```sh
pnpm typecheck
pnpm lint
pnpm dead-code:audit
pnpm test
pnpm build
```

Turborepo runs workspace checks alongside the root registry and script tests.
Builds track source-only workspace dependencies; independent checks use transit
tasks to retain dependency-aware caching without serializing package checks.
`pnpm build` builds the web app; `pnpm build:docs` builds the docs site.

Unit and component tests use Vitest. Real-DHIS2 browser tests use Playwright.

`pnpm dead-code:audit` runs the complete Knip configuration and fails on any
finding, including circular imports. Use `pnpm audit:exports` for a focused
interactive export report.

## Real-DHIS2 browser tests

The existing version-specific commands remain available from the repository
root:

```sh
pnpm e2e:41
pnpm e2e:42
pnpm e2e:43
pnpm e2e:dev
```

The runners own the isolated DHIS2 stacks; Playwright owns app startup and
shutdown through `webServer`. App logs remain under `e2e/artifacts/<version>/`
and docs preview logs under `e2e/artifacts/docs/`. Existing app servers are never
reused. Set `KEEP_E2E_STACK=1` or `KEEP_DOCS_STACK=1` to retain the corresponding
backend after tests (not the app server).

Playwright arguments are forwarded, for example:

```sh
pnpm e2e:42 --grep 'real DHIS2 server contract'
pnpm docs:e2e --grep 'documentation catalog'
```

See the [DHIS2 Application Platform documentation](https://platform.dhis2.nu/)
for platform-specific development and deployment guidance.
