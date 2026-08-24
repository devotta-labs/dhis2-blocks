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
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from '@/components/working-list'
```

The installed components own their styling through Tailwind utility classes;
the block does not require a separate stylesheet import. Adjust the import path
above if the project's components alias differs from `@/components`.

Render `WorkingList.Provider` beneath the DHIS2 app-runtime provider and a
TanStack `QueryClientProvider`. Compose the standard UI with
`WorkingList.Default`, or arrange the individual compound components:

```tsx
<WorkingList.Provider {...providerProps}>
    <WorkingList.Default onClick={handleResultClick} />
</WorkingList.Provider>
```

`selectedSavedListId` accepts a saved-list ID or `undefined`. Passing
`undefined` (or omitting the prop) starts from the generated default list; do
not use an empty string as an unset sentinel.

The base components use `WorkingList.Section` for their semantic regions. Give
each section either a visible `title` or an `ariaLabel`, but never both:

```tsx
<WorkingList.Provider {...providerProps}>
    <WorkingList.Container>
        <WorkingList.Section title={t('Saved views in this program')}>
            <WorkingList.SavedViews />
        </WorkingList.Section>
        <WorkingList.Section ariaLabel={t('Tracked entity filters')}>
            <WorkingList.Toolbar>
                <WorkingList.Columns />
                <WorkingList.Filters />
                <WorkingList.Actions />
            </WorkingList.Toolbar>
        </WorkingList.Section>
        <WorkingList.Section ariaLabel={t('Working list results')}>
            <WorkingList.Results onClick={handleResultClick} />
        </WorkingList.Section>
    </WorkingList.Container>
</WorkingList.Provider>
```

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
