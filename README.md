# DHIS2 blocks

This repository is a pnpm and Turborepo monorepo for reusable DHIS2 UI blocks
and the applications used to develop them.

## Workspace layout

```text
apps/
  web/                  DHIS2 wrapper and component demo application
packages/
  working-list/         Canonical Working List source and test harness
e2e/                    Real-DHIS2 Playwright coverage
scripts/e2e/            Real-DHIS2 environment orchestration
```

The web application depends on `@dhis2-blocks/working-list` through pnpm's
`workspace:*` protocol. The private workspace package resolves directly to its
source entry point, so the demo, tests, and production application build all
exercise the same canonical source.

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

The deployable application bundle is built with:

```sh
pnpm build
```

The DHIS2 application output is written below `apps/web/build`.

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

The private `@dhis2-blocks/working-list` workspace package remains only as the
repository's canonical development and test harness. It is not a compiled or
publishable consumer package.

## Quality checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Turborepo runs each task in the workspaces that provide it and caches declared
build outputs.

Run `pnpm audit:exports` to inspect statically unused internal exports. This is
currently a review audit rather than a required quality gate; see
[Unused export analysis](docs/unused-exports.md) for its public API exemption,
limitations, and adoption plan.

## Real-DHIS2 browser tests

The existing version-specific commands remain available from the repository
root:

```sh
pnpm e2e:41
pnpm e2e:42
pnpm e2e:43
pnpm e2e:dev
```

See the [DHIS2 Application Platform documentation](https://platform.dhis2.nu/)
for platform-specific development and deployment guidance.
