# DHIS2 blocks

This repository is a pnpm and Turborepo monorepo for reusable DHIS2 UI blocks
and the applications used to develop them.

## Workspace layout

```text
apps/
  web/                  DHIS2 wrapper and component demo application
packages/
  blocks/
    context-selector/   Capture-style controlled context-selector primitives
    ui/                 Shared DHIS2-styled shadcn primitives and theme
    working-list/       Canonical Working List source and registry manifest
e2e/                    Real-DHIS2 Playwright coverage
scripts/e2e/            Real-DHIS2 environment orchestration
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

## Event Form block

The Event Form creates or edits one tracker event of a program stage, with the
program's rules applied. It is a source-installed registry block like the
others, and it pulls in the shared UI primitives, the `dhis2-theme` item and
`use-program-rules` (which brings the program-rules lib). Install it in a
project with Tailwind CSS enabled and a valid shadcn `components.json`:

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/event-form
```

Render it beneath the DHIS2 app-runtime provider and a TanStack Query
`QueryClientProvider`. The parts go in `children`, so the host lays the form
out, and the host owns navigation: the block never routes.

```tsx
import {
    EventForm,
    EventFormActions,
    EventFormDetails,
    EventFormFeedback,
    EventFormNotes,
    EventFormSections,
} from '@/components/event-form'

export const CaptureEvent = ({ enrollmentId, orgUnitId, navigate }: Props) => (
    <EventForm
        programId="WSGAb5XwJ3Y"
        programStageId="WZbXY0S00lP"
        enrollmentId={enrollmentId}
        orgUnitId={orgUnitId}
        onSaved={({ eventId, outcome }) => navigate(`/events/${eventId}`)}
        onCancel={() => navigate(-1)}
    >
        <EventFormDetails />
        <EventFormFeedback />
        <EventFormSections />
        <EventFormNotes />
        <EventFormActions />
    </EventForm>
)
```

| Prop              | Type                                                          | Notes                                                                    |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `programId`       | `string`                                                      | Required.                                                                |
| `programStageId`  | `string`                                                      | Required. The stage whose data elements and sections the form shows.     |
| `enrollmentId`    | `string`                                                      | Required. The enrollment a new event belongs to.                         |
| `orgUnitId`       | `string`                                                      | Required. The org unit of a new event; an existing event keeps its own.  |
| `eventId`         | `string`                                                      | Omit to create a new event; the block generates its UID on the client.   |
| `trackedEntityId` | `string`                                                      | Sent with the event when given.                                          |
| `writer`          | `EventWriter`                                                 | Saves this form's event. See the writer contract below.                  |
| `onSaved`         | `(result: { eventId; outcome: 'saved' \| 'queued' }) => void` | Required. Called after a successful save or complete.                    |
| `onCancel`        | `() => void`                                                  | Required. Called on Cancel, after asking when there are unsaved changes. |
| `children`        | `ReactNode`                                                   | Required. The form parts.                                                |
| `className`       | `string`                                                      | Class for the loading and error states.                                  |

Parts: `EventFormDetails` (report date, organisation unit and, for a stage that
captures a point, the coordinate), `EventFormSectionNav`, `EventFormSections`
(or `EventFormSection id` and `EventFormField id` to lay out sections and
questions yourself), `EventFormNotes`, `EventFormFeedback` (rule texts that
belong to no question) and `EventFormActions` (Save, Complete and Cancel). Read
the form with `useEventFormState()`, drive it with `useEventFormActions()`
(`save`, `complete`, `cancel`, `reset`) and ask why a value changed with
`useEventFormRules()`.

### Writer contract

```ts
type EventWriter = (
    payload: EventPayload
) => Promise<Result<{ outcome: 'saved' | 'queued' }, SaveError>>
```

The payload is plain JSON, `{ events: [event] }` with exactly one event, and
`Result` is [`better-result`](https://github.com/dmmulroy/better-result). An
`EventPayload` event has these fields:

| Field                     | Type                                               | Notes                                          |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `event`                   | `string`                                           | Client-generated UID.                          |
| `program`, `programStage` | `string`                                           |                                                |
| `enrollment`              | `string`                                           |                                                |
| `trackedEntity`           | `string`                                           | Only when the `trackedEntityId` prop is given. |
| `orgUnit`                 | `string`                                           | Omitted when none is set.                      |
| `status`                  | `EventStatus`                                      | `COMPLETED` when completing.                   |
| `occurredAt`              | `string`                                           | `yyyy-MM-dd`; omitted when none is set.        |
| `geometry`                | `{ type: 'Point'; coordinates: [number, number] }` | Only for a stage that captures a point.        |
| `dataValues`              | `{ dataElement: string; value: string \| null }[]` | `null` clears a value on an edit.              |
| `notes`                   | `{ value: string }[]`                              | The new note, if one was typed.                |

`saved` means the server has the event; `queued` means the writer stored it to
send later (for example in an offline outbox), so the event is not on the
server yet and the host should say so. A failure is a `SaveError`:
`validation` (with the server's `fieldErrors` keyed by data element and
`formErrors`), `network` or `unknown`.

The `writer` prop is scoped to that form: it never becomes the QueryClient's
default. Without it the form uses the online writer, which posts to `/tracker`
with `importStrategy=CREATE_AND_UPDATE` and `atomicMode=OBJECT`, waits for the
import report and only reports `saved` when the event was imported. A host can
instead register one default writer for every form, so a persisted mutation
resumes after a reload:

```ts
import { registerEventFormMutations } from '@/components/event-form'

registerEventFormMutations(queryClient, myWriter)
```

The online writer is exported, so a host can wrap it. `useEventFormClient()`
returns the client over the app-runtime data engine, and
`createOnlineEventWriter(client)` builds the writer from it. (`createEventFormClient(engine)`
builds a client from any engine with the `DataEngineLike` shape.) An outbox-style
writer tries online first and queues on a network failure:

```tsx
import {
    createOnlineEventWriter,
    useEventFormClient,
    type EventPayload,
    type EventWriter,
} from '@/components/event-form'
import { Result } from 'better-result'
import { useMemo } from 'react'

const useOutboxWriter = (outbox: { add(payload: EventPayload): void }) => {
    const client = useEventFormClient()
    return useMemo<EventWriter>(() => {
        const online = createOnlineEventWriter(client)
        return async (payload) => {
            const result = await online(payload)
            if (result.isErr() && result.error.kind === 'network') {
                outbox.add(payload)
                return Result.ok({ outcome: 'queued' })
            }
            return result
        }
    }, [client, outbox])
}
```

Pass the result as the `writer` prop, or register it with
`registerEventFormMutations(queryClient, writer)`. `eventFormMutationKeys` is
exported too. `EventFormTextProvider` replaces the `@dhis2/d2-i18n` translation
with your own `translate(message, values)`.

### Program rules

Rule effects are an overlay on the answers: a rule that assigns or clears a
value changes what the form shows and what is saved, never the stored answers,
so opening an existing event never makes it dirty and the overlay lifts when
the rule stops applying. Save sends the effective values, with cleared values
as `null` on an edit. What a rule error blocks depends on the stage's
validation strategy: `ON_UPDATE_AND_INSERT` blocks both Save and Complete,
`ON_COMPLETE` blocks only Complete, and `NONE` blocks neither. A rule warning
asks before completing.

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

## Quality checks

```sh
pnpm typecheck
pnpm lint
pnpm dead-code:audit
pnpm test
pnpm build
```

Turborepo runs each task in the workspaces that provide it and caches declared
build outputs.

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

See the [DHIS2 Application Platform documentation](https://platform.dhis2.nu/)
for platform-specific development and deployment guidance.
