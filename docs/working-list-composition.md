# Working List composition

## Consumer contract

The Working List is a source-installed React 18 block. Install it into a
Tailwind-enabled project with a valid shadcn `components.json`, then import it
through the configured components alias. The host must already provide DHIS2
app-runtime context and TanStack Query context.

The canonical composition is intentionally readable from its component names:

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

Use flat, root-prefixed named exports for new code. The root provides the shared
state and data boundary; descendants consume that boundary without prop
drilling. Components may be omitted or reordered when an application does not
need the standard visual composition.

## Component responsibilities

- `WorkingList` is the provider, lifecycle boundary, and outer visual and
  semantic root. It initializes program metadata and capabilities, owns the
  scoped store and queries, renders offline status, and presents unsupported
  DHIS2 or fatal initialization errors.
- `WorkingListViewSwitcher` renders the semantic saved-view section, including
  its localized default heading. It owns view loading, selection, discard,
  sharing, deletion, and view-action errors.
- `WorkingListToolbar` is the single structural toolbar. It supplies
  `role="toolbar"` and a localized accessible label by default.
- `WorkingListColumnSelector` owns the column trigger and settings dialog.
- `WorkingListFilterControls` owns stage and filter controls plus their local
  editor state.
- `WorkingListToolbarActions` keeps save, update, and download actions together
  as one cluster and owns their local action errors.
- `WorkingListTable` owns selection loading and errors, query loading and
  errors, empty results, stale-view repair, table rendering, and pagination.
  `dataQualityMode` remains its explicit presentation variant.

Lifecycle errors do not move into child components. View query and view-action
errors stay in `WorkingListViewSwitcher`; result query, empty, repair, and
pagination states stay in `WorkingListTable`.

Structural components forward the native props for their root element,
including `className`, `aria-*`, and `data-*`. Their accessible defaults are
localized and may be overridden with native accessibility props. The view
switcher's visible heading may be replaced with its `heading` prop.

## View and pagination state

View selection and pagination are independent controlled/uncontrolled state
channels. Omitting both gives a useful first render:

```tsx
<WorkingList programId={programId} orgUnitId={orgUnitId}>
    {/* children */}
</WorkingList>
```

The uncontrolled defaults are the generated program view and
`{ page: 1, pageSize: 15 }`. Initial values and optional notification callbacks
can be supplied without taking ownership of updates:

```tsx
<WorkingList
    programId={programId}
    orgUnitId={orgUnitId}
    defaultViewId={initialViewId}
    onViewChange={rememberView}
    defaultPagination={{ page: 1, pageSize: 25 }}
    onPaginationChange={rememberPagination}
>
    {/* children */}
</WorkingList>
```

For URL or application state, pass either or both controlled pairs:

```tsx
<WorkingList
    programId={programId}
    orgUnitId={orgUnitId}
    viewId={viewId}
    onViewChange={setViewId}
    pagination={pagination}
    onPaginationChange={setPagination}
>
    {/* children */}
</WorkingList>
```

The types reject `viewId` without `onViewChange` and `pagination` without
`onPaginationChange`. A program change creates a fresh scoped root and restores
uncontrolled initial state. An organisation-unit change preserves view
selection and resets pagination to page 1 through the normal provider
transition. Multiple roots create independent stores, local state, IDs, and
queries.

## Row behavior

`onRowClick` receives an ID-only discriminated target:

```ts
type WorkingListResultTarget =
    | {
          mode: 'trackedEntity'
          programId: string
          trackedEntityId: string
      }
    | {
          mode: 'event'
          programId: string
          programStageId: string
          eventId: string
          enrollmentId?: string
          trackedEntityId?: string
      }
```

The callback is optional. Without it, rows have no pointer cursor, click
handler, hidden keyboard control, row role, or tab stop. With it, a pointer can
open a row from a non-interactive cell and keyboard users receive an in-row
button. Links and other interactive cell content retain their own behavior.

## Hooks and view actions

Custom descendants can use:

```ts
useWorkingListState(selector)
useWorkingListMeta(selector)
useWorkingListActions()
```

The action hook uses view terminology for new code: `selectView`,
`clearViewSelection`, `createView`, `updateSelectedView`, and `deleteView`.
Configuration, pagination, and download actions keep their existing names.

## Distribution boundary

The shadcn registry copies production source and dependencies into the
consumer repository. The installed source entry point exports the canonical
components, selector hooks, aggregate contracts, view and pagination contracts,
result targets, and public tagged errors. DHIS2 client details, query keys,
schemas, normalized server resources, the Zustand store, and repair/sharing
internals remain private and replaceable.
