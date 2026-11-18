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
      data-table/       Data Table block
      patient-list/     Patient List block
      calendar/         Generic month calendar for any dated records
      sidebar/          Composable modeling-app navigation with a collapse rail
      data-entry/       Grid data entry for DHIS2 events
      timeline/         Read-only timeline layout, with tracker history hooks in dhis2/
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

This starts the DHIS2 custom wrapper from `apps/web`, which shows a patient
list for a chosen program and organisation unit; the app builds its columns
and filters from program metadata. Block source changes receive hot updates
without a separate library build. By default the DHIS2 Application Platform
opens the application at [http://localhost:3000](http://localhost:3000).

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

## Value input block

`dhis2-value-input` is a form control for each DHIS2 value type, accepting what the grid accepts, in the system calendar. It reports a value when it is committed, not on each keystroke. The grid below uses its pop-up editors.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/dhis2-value-input
```

See `/blocks/dhis2-value-input` in the docs.

## Spreadsheet and Tracker Data Entry blocks

Two blocks enter DHIS2 data in a grid, typed in like a spreadsheet.

`spreadsheet` is the grid: DHIS2-typed cells, Excel-style keys, paste and undo,
and the state of each cell, for any data your app saves. It knows nothing about
events, people or rules. You give it a cell store, the tables to show and a
store of what your logic says about each cell.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/spreadsheet
```

`tracker-data-entry` fills the grid with the events of an event or tracker
program, or a paper register of people. Every change is kept on the device
before it is sent, so nothing typed is lost to a dropped connection, a reload
or a crash, and program rules run for the rows whose stage the grid shows, as
Capture runs them.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/tracker-data-entry
```

The install also pulls in `spreadsheet`, `dhis2-value-types` (what each value
type accepts), `dhis2-value-display` (the calendar) and `program-rules`. Import
from `@/components/tracker-data-entry` and `@/components/spreadsheet`, and
render `TrackerDataEntry` beneath the DHIS2 app-runtime provider and a TanStack
`QueryClientProvider`:

```tsx
import { SpreadsheetGrid } from '@/components/spreadsheet'
import {
    TrackerDataEntry,
    TrackerDataEntrySummary,
    eventSource,
} from '@/components/tracker-data-entry'

// Made once: a source with new keys loads the form again.
const inpatient = eventSource({
    programId: 'eBAyeGv0exc',
    orgUnitId: 'DiszpKrYNg8',
})

export const InpatientGrid = () => (
    <TrackerDataEntry source={inpatient}>
        <SpreadsheetGrid />
        <TrackerDataEntrySummary />
    </TrackerDataEntry>
)
```

`eventSource` takes the events of a program, of one stage, or of one person
(`enrollmentId`). See `/blocks/tracker-data-entry` for live examples of each,
registers, program rules and how changes are saved, and `/blocks/spreadsheet`
for the keyboard, the cell store and replacing a control.

## Timeline block

Show a person's history across programs: events, enrollment milestones and
notes, and attribute changes, grouped by day around "now".

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/timeline
```

Import the layout from `@/components/timeline` and the tracker layer from
`@/components/timeline/dhis2`. `Timeline` takes a plain array of entries and
never fetches; `useTrackedEntityHistory` returns that array for one tracked
entity in every program they are enrolled in, and `TimelineHistoryEntry`
renders each entry. See [the block's README](packages/registry/blocks/timeline/README.md),
`/blocks/timeline` in the docs and `/playground/timeline`.

## Calendar block

A standalone month calendar for any dated records, with navigation, selection,
status counts, weekend columns and a selected-day list. No other block or
data provider is required.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/calendar
```

Import `Calendar`, `CalendarNavigation`, `CalendarGrid` and
`CalendarDayRecords` from `@/components/calendar`. Supply records with
`id`, `date` and `label`; optionally add a status and `onRecordClick`.
For remote data, `useCalendarState` exposes the visible range and
`CalendarProvider` connects it to your query results.
See the standalone project-milestones example at `/blocks/calendar`.

## Patient List + Calendar composition

Show a Patient List's tracked entities on a month calendar by composing the two
blocks.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/patient-list devotta-labs/dhis2-blocks/calendar
```

Copy the tested recipe from `/blocks/patient-list#calendar-view`. Its
`PatientCalendar.tsx` takes the list's query and passes Calendar's visible
range to `usePatientListQuery`. Calendar stays independent of Patient List.

## Data Table block

A generic table for any row type, built on TanStack Table v9 and the
DHIS2-styled primitives. It sorts, filters, searches and pages, selects rows,
lets people show, hide, reorder, pin and resize columns, groups rows, opens a
detail panel under a row, draws only the rows in view for large pages, and
exports CSV. In client mode the table filters, sorts and pages your `data`; in
server mode `data` is one page and you run the query from the table state. It
knows nothing about DHIS2 metadata: the columns, cell formatters and filters
are yours.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/data-table
```

Import from `@/components/data-table`. `useDataTable` creates the table, and
every part renders inside `DataTable`, which names the table with `label`:

```tsx
import {
    DataTable,
    DataTableContent,
    DataTablePagination,
    createDataTableColumnHelper,
    useDataTable,
} from '@/components/data-table'

type Facility = { id: string; name: string; beds: number }

const column = createDataTableColumnHelper<Facility>()
const columns = column.columns([
    column.accessor('name', { header: 'Name' }),
    column.accessor('beds', { header: 'Beds', meta: { align: 'end' } }),
])

export const FacilityTable = ({ facilities }: { facilities: Facility[] }) => {
    const table = useDataTable({
        data: facilities,
        columns,
        getRowId: (facility) => facility.id,
    })
    return (
        <DataTable table={table} label="Facilities">
            <DataTableContent />
            <DataTablePagination />
        </DataTable>
    )
}
```

Keep `data` and `columns` stable (module constants, `useMemo` or query data):
new `data` collapses expanded rows and, in client mode, goes back to the first
page. The tools (`DataTableToolbar`, `DataTableSearch`, `DataTableFilters`,
`DataTableColumnSettings`, `DataTableSelectionBar`, `DataTableExportButton`)
render inside `DataTable` too. See `/blocks/data-table` for each feature and
for server mode.

## Patient List block

The tracked entities in one program and organisation unit, on the Data Table
in server mode: one page per request to `tracker/trackedEntities`, with
sorting, filters and paging done by the server. You define the columns, how
each value is formatted and the filters, and each filter states the tracker
query parameters it sends. Nothing is derived from program metadata; the
block never requests programs, attributes or option sets.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/patient-list
```

The install also pulls in `data-table`. Import from
`@/components/patient-list`, and render the list beneath the DHIS2 app-runtime
provider and a TanStack `QueryClientProvider`:

```tsx
import {
    PatientList,
    attributeColumn,
    attributeTextFilter,
    enrollmentStatusFilter,
    fieldColumn,
    usePatientList,
} from '@/components/patient-list'

const columns = [
    attributeColumn('w75KJ2mc4zz', { header: 'First name' }),
    attributeColumn('zDhUuAYrxNC', { header: 'Last name' }),
    fieldColumn('enrolledAt', {
        header: 'Enrolled',
        format: (value) => (value ? value.slice(0, 10) : ''),
    }),
]
const filters = [
    attributeTextFilter({
        attribute: 'w75KJ2mc4zz',
        label: 'First name',
        pinned: true,
    }),
    enrollmentStatusFilter({ pinned: true }),
]

export function ChildProgrammeList() {
    const list = usePatientList({
        program: 'IpHINAT79UW',
        orgUnit: 'DiszpKrYNg8',
        columns,
        filters,
        initialState: { pagination: { pageIndex: 0, pageSize: 15 } },
    })
    return (
        <PatientList list={list} onRowOpen={(row) => open(row.trackedEntity)} />
    )
}
```

`attributeColumn` shows an attribute's stored value and `fieldColumn` a tracked
entity or enrollment field; format values in `format`. Keep `columns` and
`filters` stable: define them outside the component or in a `useMemo`.
`usePatientList` takes every `useDataTable` option except `data`, `mode`,
`getRowId` and `rowCount`.

The hook keeps sorting, column filters and pagination itself, starting from
`initialState` (15 rows a page by default). A new sort, filter, program or
organisation unit goes back to the first page. To keep a slice yourself, pass
both `state.<slice>` and its `on…Change`; a change handler alone is ignored.
Hold a controlled page in React state, not directly in a router URL, so a new
sort or filter and the return to the first page reach the request in the same
update:

```tsx
const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 })
const list = usePatientList({
    program,
    orgUnit,
    columns,
    filters,
    state: { pagination },
    onPaginationChange: setPagination,
})
```

When the program or organisation unit changes, reset your page with it, or
give the component that calls the hook a new `key`. See `/blocks/patient-list`
for formatting values, every filter, your own layout from the data table parts,
and `usePatientListQuery` for the rows without a table.

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
  `block.json`; tests and `__tests__/` are never shipped;
- npm `dependencies` come from each item's imports, versioned by
  `packages/registry/package.json`, and `registryDependencies` from its
  `@/components/dhis2/ui/*` and `@/components/<block>` imports.

The generator rejects imports that would break once installed, such as a
relative import into another block or an `@/` alias the CLI cannot rewrite.

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
`input-group`, `kbd`, `label`, `popover`, `portal-root`, `select`, `separator`,
`spinner`, `switch`, `table`, `textarea`, `toggle`, `toggle-group`, and
`tooltip`. Items that import siblings (for example `combobox` imports `select`
and `input-group`) install them too.

Every design token is namespaced (`--dhis2-*`, `--color-dhis2-*`,
`--radius-dhis2-*`, `--shadow-dhis2-*`, `--font-dhis2`), so utilities such as
`bg-dhis2-primary` or `text-dhis2-muted-foreground` coexist with the host
application's own Tailwind theme and never replace it. The theme ships semantic
roles only, no palette, so everything coloured with it follows the contrast
setting. Run `pnpm registry:check` to verify the published items
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
catalog browsing without a backend and live Patient List filtering, sorting
and pagination.

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

`anti-slop/require-standalone-hook-calls` keeps hook calls out of conditions,
JSX, arguments and other composed expressions, and bans reading a property or
calling a method directly on a hook's result. Store or destructure the result
first:

```tsx
const { status } = useFinderResults()
if (status !== 'searching') {
    return null
}
```

Direct variable initializers, standalone effects and direct returns are allowed
at function-body level (including concise hook-forwarding arrows). Parentheses
and TypeScript-only wrappers do not hide chained access. Hook names follow
`use` + uppercase letter/digit, including PascalCase namespaces such as
`React.useState`; lowercase utility objects such as `vi.useFakeTimers` are not
hooks. This is an expression-placement rule, not a replacement for React's
Rules of Hooks control-flow checks.

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

## Accessibility

Blocks and primitives target WCAG 2.2 AA, the level Section 508, ADA Title II,
EN 301 549 and most donor and UN procurement rules ask for. They don't meet it
yet: some blocks still show states by colour alone, have mouse-only details, or
don't announce changes such as result counts and rule effects. Three checks
hold what is in place:

- `pnpm lint` runs the `jsx-a11y` rules. A rule turned off for one line says
  why beside it.
- `pnpm docs:e2e e2e/specs-docs/accessibility.spec.ts` scans every docs
  example with axe, in the default and the more-contrast theme, and presses Tab
  through each one to check every stop shows where focus is. CI runs it in the
  `docs-e2e` job of `verify` when the docs or the registry change. The job
  reports but doesn't yet block `validation`.
- Contrast, forced-colours and reduced-motion browser tests
  (`*.contrast.test.tsx`, `*.forced.test.tsx`, `*.motion.test.tsx`) check what
  axe can't see.

Axe finds about a third of WCAG problems. Every new block and primitive also:

- announces outcomes that happen away from focus with `announce(text)` from
  `@/components/dhis2/ui/announcer`, and errors with
  `announce(text, 'assertive')`
- puts focus somewhere sensible after async work, after a dialog closes, and
  when the control that had it unmounts
- keeps focus on a control it disables, with `focusableWhenDisabled`
- never shows a state with colour alone: add a word, an icon or a shape
- keeps targets at least 24 by 24 pixels
- gives every hover-only detail a keyboard path
- uses `Field` for every labelled control, so its label, hint and error reach
  screen readers
- has a docs example, which puts it under the scan

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
gets its own browser context. With a running E2E stack, use
`pnpm exec playwright test --workers=1` to debug serially.

See the [DHIS2 Application Platform documentation](https://platform.dhis2.nu/)
for platform-specific development and deployment guidance.
