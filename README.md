# DHIS2 blocks

This repository is a pnpm and Turborepo monorepo for reusable DHIS2 UI blocks
and the applications used to develop them.

## Workspace layout

```text
apps/
  web/                  DHIS2 wrapper and component demo application
  docs/                 Vite documentation site with live block previews
packages/
  registry/             @dhis2-blocks/registry: all shadcn registry source
    components/         DHIS2-styled shadcn primitives (one file per item) and theme
    blocks/
      context-selector/ Capture-style controlled context-selector primitives
      working-list/     Working List block
      sidebar/          Composable modeling-app navigation with a collapse rail
    test/               Shared Vitest browser setup
e2e/                    Real-DHIS2 Playwright coverage
scripts/e2e/            Real-DHIS2 environment orchestration
scripts/docs/           Documentation site backend lifecycle
```

All registry source shares one `package.json`, `tsconfig.json` and
`vitest.config.ts` in `packages/registry/`. Source imports items exactly as an installed
project does: `@/components/dhis2/ui/<component>` and `@/components/<block>`.
The apps map those aliases to `packages/registry/components` and
`packages/registry/blocks`, so
the demo, docs, tests and production build all exercise the same source.

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

## Sidebar block

Build navigation with expandable groups, footer actions, and a collapsible sidebar.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/sidebar
```

Import from `@/components/sidebar`. Use `SidebarLink` with
`render={<NavLink to="/projects" />}` to highlight the current page. Add
`SidebarGroup` for nested links and `SidebarButton` for footer actions.
Use `SidebarToggle` in the sidebar, or `useSidebar()` for a page-toolbar control.
Collapsing preserves the open groups and selected page.

See `/blocks/sidebar` for navigation, shared collapse controls, and right-to-left
examples.

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

The `packages/registry` workspace is a development and test harness only; it is not
compiled or published as an npm package.

The root `registry.json` is the public registry entry point. It is generated
from `packages/registry/` by `pnpm registry:write`; do not edit it by hand.

### Registry development

This is a [GitHub source registry](https://ui.shadcn.com/docs/registry/github):
consumers install straight from the repository. There is no registry server or
built JSON to deploy. Item addresses are flat (`devotta-labs/dhis2-blocks/<item>`)
because shadcn looks items up by name, whatever folder their source lives in;
names must be unique across components and blocks.

```sh
pnpm registry:write    # regenerate registry.json from packages/registry/
pnpm registry:validate # registry.json is up to date, then the official CLI's schema and file checks
pnpm registry:build    # official CLI: optional local artifacts in dist/registry
pnpm registry:check    # validate, build, install, typecheck and bundle fresh consumers
```

Development and CI use the lockfile-pinned `shadcn` CLI. The install check uses
the CLI's supported local JSON files, without an HTTP server. It rewrites only
same-repository `registryDependencies` in temporary build artifacts, so those
items come from the checkout being tested, not the default branch.
GitHub `#ref` values are **not inherited** by dependencies; adding a branch ref
to an install command alone is not enough to test an unmerged dependency graph.

After adding or editing a component, block or token, run `pnpm registry:write`
and commit `registry.json`. The generator (`tools/registry/buildRegistry.ts`)
derives every item from source:

- each `packages/registry/components/*.ts(x)` file is a `registry:ui` item installed to
  `@components/dhis2/ui/`, and `theme.css` becomes the `dhis2-theme` item;
- each `packages/registry/blocks/<name>/` folder is a `registry:block` item installed to
  `@components/<name>/`, with its title, description and docs from
  `block.json`; tests, `__tests__/` and
  `type-tests/` are never shipped;
- npm `dependencies` come from each item's imports, versioned by
  `packages/registry/package.json`, and `registryDependencies` from its
  `@/components/dhis2/ui/*` and `@/components/<block>` imports.

The generator rejects imports that would break once installed, such as a
relative import into another block or an `@/` alias the CLI cannot rewrite.

## Relationship Viewer block

The Relationship Viewer is a read-only source registry block that draws the
relationships around DHIS2 tracker records as a web or a trace. Install it
from the GitHub registry in a project with Tailwind CSS enabled and a valid
shadcn `components.json` configuration:

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/relationship-viewer
```

Render `RelationshipViewer` beneath the DHIS2 app-runtime provider and a
TanStack `QueryClientProvider`. The minimal complete composition is:

```tsx
import {
    RelationshipViewer,
    RelationshipViewerCanvas,
    RelationshipViewerLayoutToggle,
    RelationshipViewerLegend,
    RelationshipViewerList,
    RelationshipViewerNotices,
    RelationshipViewerSummary,
    enrollmentStatus,
    type RelationshipNode,
    type RelationshipStatus,
} from '@/components/relationship-viewer'

const statuses: RelationshipStatus[] = [
    { key: 'confirmed', label: 'Confirmed', color: '#c0392b', attention: true },
    { key: 'other', label: 'Other', color: '#7f8c8d' },
]

const statusOf = (node: RelationshipNode) =>
    enrollmentStatus(node, programId) === 'ACTIVE' ? 'confirmed' : 'other'

export const Contacts = ({ trackedEntityId }: { trackedEntityId: string }) => (
    <RelationshipViewer
        seeds={{ refs: [{ kind: 'trackedEntity', id: trackedEntityId }] }}
        program={programId}
        statuses={statuses}
        statusOf={statusOf}
    >
        <RelationshipViewerLayoutToggle />
        <RelationshipViewerSummary />
        <RelationshipViewerNotices />
        <RelationshipViewerCanvas />
        <RelationshipViewerLegend />
        <RelationshipViewerList />
    </RelationshipViewer>
)
```

Declare `statuses` and `statusOf` outside the component, or memoise them, so
the graph's summary is not recomputed on every render.

`seeds` is either `{ refs }` or `{ query }`, a tracker query that must name its
`program`. With a seed query, `program` may be left out; passing a different
`program` throws. `hops` (default 1) and `cap` (default 500) bound the traversal, and
every followed link that is not drawn is shown as a stub count, an "other
links" count, a failed-node marker or the cap notice. Adjust the import path if
the project's components alias differs from `@/components`.

DHIS2 omits relationships the user cannot read on both sides, so a record can
have more links than the viewer shows.

## UI primitives

The shared DHIS2-styled shadcn primitives live in `packages/registry/components` and are
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

### Vercel deployments

The docs project is `eirikh/dhis2-blocks`, connected to the
`devotta-labs/dhis2-blocks` GitHub repository. Its production branch is
`master`: pushes to `master` deploy to `https://dhis2-blocks.vercel.app`,
and pushes to other branches create preview deployments linked from PRs.

Vercel uses the repository root with the settings committed in `vercel.json`:
`pnpm install --frozen-lockfile`, `pnpm build:docs`, and output directory
`apps/docs/dist`. Client-side routes fall back to `index.html`; `/dhis2`
requests use `api/dhis2.mjs` and the shared proxy implementation.

Set `DOCS_DHIS2_URL=https://play.im.dhis2.org/dev` in both the Production
and Preview environments. This public demo uses the authentication defaults
described above. Vercel owns the Git connection, production branch, and
environment settings; these must also be configured when recreating the
project. Local `.env` files are excluded from CLI uploads by `.vercelignore`.

Normal releases come from GitHub pushes. To link a local checkout for
inspection, run `vercel link --project dhis2-blocks --scope eirikh`.
The generated `.vercel` directory is local state and is not committed.

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

CI runs typechecking, tests, app/docs builds, lint, Knip, and DHIS2 dev E2E
in parallel. Path filters skip unrelated jobs (for example, docs-only changes
do not start the web app's E2E stack). Feature branches compare against their
merge-base with the default branch, so later documentation commits cannot hide
untested code changes. The `validation` check collects the static check results
and fails if any relevant job fails or is cancelled.

The separate `e2e-nightly` workflow runs DHIS2 41, 42, and 43 E2E at 02:23 UTC
on the default branch. A manual `verify` run checks everything against dev;
a manual `e2e-nightly` run checks the stable versions, with `all-versions`
optionally including dev. Both workflows share the same E2E action. E2E
results are never cached because the backend images move independently of
this repository.

CI caches the pnpm store, Playwright binaries (by exact version), per-job Turbo
results, and pristine database dumps (refreshed weekly). Databases are still
initialized and seeded from scratch on every E2E run. Turbo tracks transitive
workspace sources, shared configuration, lockfiles, and build environment
variables before reusing results. Lint still runs for prose-only changes since
the formatter checks Markdown and workflow files too.

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

Playwright schedules independent tests across files and within each file in
parallel, using two workers in CI and its CPU-based default locally. Each test
gets its own browser context; saved-list tests clean up their own created
records and restore the stale-list fixture. With a running E2E stack, use
`pnpm exec playwright test --workers=1` to debug serially.

See the [DHIS2 Application Platform documentation](https://platform.dhis2.nu/)
for platform-specific development and deployment guidance.
