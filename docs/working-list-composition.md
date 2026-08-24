# Working List composition refactor

## Purpose

Refactor the Working List into a source-owned, composable React 18 block. The
provider owns the working-list domain and query lifecycle, while compound
components render the existing workflows from a shared state, meta, and actions
interface.

The refactor preserves the current Working List behavior and user interface
except for intentional changes stated in this document.

## Distribution

Distribute the Working List as a source registry block. Installation copies the
production source files and required package dependencies into the consuming
repository so the block can be edited in place.

The source registry is the only supported consumer distribution. The installed
source entry point and its documented exports define the consumer contract. Do
not also maintain compiled-package, `npm pack`, package-export, or generated
declaration compatibility as supported deliverables.

Keep the workspace package private as the canonical development and test
harness. Its repository-only import path may continue to support the demo
application and canonical tests, but it is not a consumer distribution. Remove
package build and packaging infrastructure that exists only to produce a
compiled consumer artifact. The installed block contains production source
files; tests remain in this canonical repository.

The installed source entry point exports only:

- The compound `WorkingList` component.
- `useWorkingListState`, `useWorkingListMeta`, and
  `useWorkingListActions`.
- The documented provider, component, state, meta, action, configuration,
  result-target, pagination constant, and operation-error contracts required to
  consume those exports.
- Public tagged-error classes returned by public actions or exposed public query
  state.

Do not export the DHIS2 client, request or response schemas, TanStack Query keys
or options, serializers, normalized server records, Zustand store, persistence
implementation, or private sharing and repair interfaces. These remain
replaceable implementation details of the installed block.

## Composition

Expose the following compound components:

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
            <WorkingList.Results />
        </WorkingList.Section>
    </WorkingList.Container>
</WorkingList.Provider>
```

`WorkingList.Default` renders the standard visual composition and must be a
descendant of `WorkingList.Provider`. It does not create a provider. It accepts
the result-row `onClick` callback and `dataQualityMode` presentation prop and
forwards them to its internal `WorkingList.Results`.

Keep all compound components mounted. There is no shared content or readiness
boundary. Each component subscribes to the provider state it needs and owns its
loading, disabled, error, and ready presentation.

### Component responsibilities

- `WorkingList.Provider` is non-visual. It resolves the DHIS2 runtime client,
  API version, system information, online status, program metadata, and field
  catalog. It creates the scoped store, loads saved lists, runs result queries,
  and provides state, meta, and actions.
- `WorkingList.Container` renders the outer Working List layout and
  provider-wide blocking states such as unsupported DHIS2 versions and program
  metadata failures. It renders the provider-wide offline notice.
- `WorkingList.Section` renders a semantic region and owns its accessible name.
  It requires exactly one of `title: React.ReactNode`, which renders a visible
  heading, or `ariaLabel: string`, which names the region without a heading.
  It owns no child-specific layout or state, does not inspect its children, and
  has no title-visibility mode.
- `WorkingList.SavedViews` renders saved-view selection and saved-list query
  states. It owns the saved-view menus, discard confirmation, sharing dialog,
  and deletion confirmation. Its loading, error, and ready presentations do not
  render their own outer region or the section title.
- `WorkingList.Toolbar` is a plain flex-layout wrapper for the configuration
  controls. It remains mounted and renders the same controls, or visually
  equivalent controls, disabled when configuration is not ready. It does not
  render a region or heading.
- `WorkingList.Columns` renders the column trigger and owns the column settings
  dialog. It independently renders its loading, disabled, error, or ready
  presentation.
- `WorkingList.Filters` renders stage and filter controls and owns unapplied
  filter visibility and filter editor presentation state. It independently
  renders its loading, disabled, error, or ready presentation.
- `WorkingList.Actions` renders saving and download controls and owns the
  save-as dialog. It independently renders mutation and interaction states.
- `WorkingList.Results` renders result loading, error, empty, updating, table,
  pagination, incompatible-list, and stale-list repair states. It owns blocking
  errors, repair UI, and accessible loading announcements, but not the outer
  semantic region or its heading. It requires the `onClick` callback for
  application behavior when a result row is clicked. It also receives
  `dataQualityMode?: 'hidden' | 'highlighted'`, which defaults to `'hidden'`.

The result click callback receives an ID-only discriminated payload:

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

The payload is assembled from provider context and the underlying tracker
record rather than exposing the normalized table row.

`onClick` is required by both `WorkingList.Results` and
`WorkingList.Default`. Rows retain their existing mouse and keyboard
interaction semantics.

Data-quality display mode remains a Results presentation prop. It does not
belong to provider state, saved-list configuration, or query inputs.

Dialog visibility, open menus, pending confirmation targets, and unapplied
filter controls remain local to their owning component.

Local interaction errors remain with the component, dialog, or menu that
initiated the operation.

## Provider and store

Each provider creates one scoped Zustand store. Descendants of that provider
share the same Working List. Multiple providers create independent Working
Lists.

The provider requires a program ID and organisation-unit ID. These IDs are its
application-context inputs. It fetches its own metadata and data and initializes
a complete valid `WorkingListState` before exposing state selectors to its
children.

Localization uses the application's configured `@dhis2/d2-i18n` instance
directly. Provider and compound-component APIs expose no `locale`, `translate`,
or localization-provider props.

The application derives `programId` and `orgUnitId` from its own state or
routing and passes their current values as provider props. The provider applies
its lifecycle rules whenever either prop changes.

The parent owns any organisation-unit scope validation. The provider does not
preload user/program organisation-unit scopes to validate `orgUnitId`; it uses
the supplied ID in the tracker request. A rejection from that request is
normalized into the regular Results error state.

The application also provides the persisted saved-list identity:

```ts
interface WorkingListSelectionProps {
    selectedSavedListId?: string
    onSelectedSavedListChange(id: string): void
}
```

Selection follows the standard controllable-state contract. When
`selectedSavedListId` is supplied, it is authoritative. An internally initiated
selection stages the requested ID synchronously and calls
`onSelectedSavedListChange`. On a subsequent render, a supplied prop value that
differs from the staged ID wins, cancels or supersedes the pending transition,
and starts the authoritative value's transition. Completion from a superseded
transition is ignored.

When `selectedSavedListId` is omitted, the provider owns selection.
`onSelectedSavedListChange` is then a persistence notification rather than a
request for the parent to echo the value. The provider resolves the omitted
initial identity to the generated default and notifies the application of that
effective ID.

Every effective ID change is a hard context transition: the provider
immediately makes the active configuration and results unavailable, resets
dirty state and pagination, and enters selection loading. After the requested
saved list is validated and loaded, the provider atomically commits its
identity, configuration, baseline, and pagination and starts its result query.

An internally initiated selection change invokes the persistence callback only
after `WorkingList.SavedViews` has completed dirty-state discard confirmation.
An external controlled-prop change is authoritative, bypasses internal discard
confirmation, and starts the hard transition immediately. It does not invoke the
selection callback.

The provider is the sole owner of Working List state. It also owns Working List
data fetching. Compound components consume the provider through selector-based
hooks:

```ts
useWorkingListState(selector)
useWorkingListMeta(selector)
useWorkingListActions()
```

State selectors subscribe only to the selected state. Meta selectors subscribe
only to the selected derived or query-backed value. The actions object is
stable.

The provider renders its children with no layout or status UI. All visible
Working List output starts at `WorkingList.Container` and its composed
descendants, allowing the provider to be mounted at the application root.

`WorkingList.Provider` assumes the host has configured TanStack Query and uses
the nearest `QueryClientProvider`.

The provider obtains the configured data engine, runtime configuration, and
online status from `@dhis2/app-runtime` and builds its internal Working List
client. These are not public props.

When offline, Container renders the existing notice once. Server mutations are
disabled by their owning components. Local configuration controls and cached
results remain available.

Each Working List query keeps its existing query-specific stale time and retry
policy. The block does not configure or mutate the host QueryClient.

The provider always renders its children. It exposes lifecycle separately from
selection, active configuration, mutations, and results:

```ts
type WorkingListLifecycleMeta =
    | { status: 'pending' }
    | { status: 'error'; error: WorkingListInitializationError }
    | { status: 'ready' }
```

`WorkingList.Container` renders initialization loading and blocking error UI
without unmounting its composed descendants. Each compound component selects
the lifecycle and domain slices it needs and renders its own presentation.

`useWorkingListMeta` is available throughout the provider lifecycle.
`useWorkingListState` and configuration actions require a ready active
configuration. Using them while active configuration is unavailable throws a
descriptive developer error. Each compound component keeps its outer component
mounted, selects readiness from meta, and mounts its stateful ready presentation
only when the active configuration is ready.

Do not expose one global `meta.status`. Public meta contains separate lifecycle,
selection, active-configuration, mutation, and results state so consumers
subscribe only to the state relevant to their component.

Dirty state has one source of truth in the provider and is exposed through
`useWorkingListMeta`. The provider has no `onDirtyChange` callback. An
application that protects route changes or browser unloads renders its own
non-visual navigation guard as a provider descendant. That guard selects
`dirty` from meta and owns React Router blocking and the `beforeunload`
listener. `WorkingList.SavedViews` separately owns confirmation for switching
saved views with unsaved changes.

## State

Expose state using the existing domain aggregates:

```ts
interface WorkingListState {
    selectedSavedListId: string
    configuration: WorkingListConfiguration
}
```

`configuration` contains the mode, applied filters, visible columns, and sort.
The selected generated default also has an ID and is represented by
`selectedSavedListId`. This state exists only for a validated, atomically
committed active selection. A requested ID that is loading, missing, or
incompatible is represented by selection meta and never appears in
`WorkingListState`.

Filters store compact references:

```ts
interface AppliedFilter {
    fieldId: string
    operator: FilterOperator
    value: FilterValue
}
```

Resolved field metadata stays outside serializable state.

### Configuration modes

Use a discriminated union:

```ts
type WorkingListConfiguration =
    | {
          mode: 'trackedEntity'
          programStageId?: never
          filters: AppliedFilter[]
          columns: string[]
          sort: WorkingListSort
      }
    | {
          mode: 'event'
          programStageId: string
          filters: AppliedFilter[]
          columns: string[]
          sort: WorkingListSort
      }
```

There is one applied filter per field. Setting a filter upserts by `fieldId`.
Applied filters are always visible. Added filter controls without an applied
value are ephemeral state owned by `WorkingList.Filters`.

### Stage transitions

Changing the program stage is one atomic state transition:

- Preserve tracked-entity filters.
- Remove event filters.
- Apply the destination mode's default columns and sort.
- Reset pagination to page 1.

Returning from an event stage restores tracked-entity mode with the same
transition rules.

## Meta

Meta contains fetched and derived information:

- Program metadata and field catalog.
- DHIS2 system information and online status.
- DHIS2 capabilities.
- Saved-list query state and normalized saved lists.
- Selected-list details and permissions.
- Dirty status calculated against the selected-list baseline.
- Normalized result status, display rows, and discriminated pagination meta.
- Separate lifecycle, selection, active-configuration, mutation, and results
  state. There is no aggregate status for the whole Working List.

Represent asynchronous result state as a domain discriminated union. Normalize
the combined records, organisation-unit label, and file-resource label queries
into this result state. Organisation-unit label failures are blocking result
errors. File-resource label failures use the existing raw-value fallback.

```ts
type WorkingListResultsMeta =
    | {
          status: 'pending'
      }
    | {
          status: 'error'
          error: WorkingListResultsError
      }
    | {
          status: 'ready'
          rows: readonly WorkingListDisplayRow[]
          pagination: WorkingListPaginationMeta
          isUpdating: boolean
      }
```

Ready results remain available while required queries for the same selected
saved list refresh and expose that condition through `isUpdating`. Empty
results are ready results with no rows.

Selection meta identifies the requested saved-list ID and independently exposes
selection loading, blocking error, or ready state. Active-configuration meta is
`unavailable` during selection loading or error and `ready` only after the
requested configuration has been validated and committed.

Saved-list resolution is a prerequisite for result fetching and committing a
new selection. When the effective selected ID changes, the provider immediately
clears the previous active-configuration and results state and enters selection
loading. Compound components remain mounted and independently render fixed-size
placeholders or accessibly announced loading. Configuration and mutation
controls remain visible but disabled. No result query runs for an unvalidated
selection.

After validation succeeds, the provider atomically commits the requested
configuration, baseline, identity, dirty state, and pagination, then starts its
result query. Previous-selection configuration and results are never used as
placeholder data. A background refresh whose effective selected ID has not
changed may retain ready configuration and results.

A passive saved-list refresh for the same selected ID may update its name,
sharing, permissions, compatibility metadata, and other normalized meta, but it
does not replace the active configuration or clean baseline with externally
changed saved configuration. If the selected resource disappears, becomes
unreadable, or becomes incompatible, the provider makes active configuration
and results unavailable and enters the corresponding blocking selection error.
A canonical refresh initiated by this provider's successful update or repair is
the exception and may commit the confirmed submitted configuration and baseline.

Saved-list mutations remain pending until a canonical refetch confirms the
server state. A failed confirmation returns a tagged error to the initiating
component. The last confirmed configuration, results, selection, and baseline
remain unchanged.

When an explicit controlled `selectedSavedListId` does not resolve after the
saved-list query succeeds, saved-view meta exposes a tagged
`SavedListNotFoundError`. `WorkingList.Results` renders the blocking error,
no previous configuration or results remain visible, no result query runs, and
the provider neither selects the generated default nor invokes the selection
callback with a replacement ID.

Return command errors to the invoking component, which owns displaying them.

Public error contracts are narrow per operation. Build each action or query
error type from reusable tagged variants and include only variants that the
operation can return. Convert internal exceptions, boundary errors, and Zod
errors into these public variants at the provider façade.

Define public variants as `better-result` `TaggedError` classes. Each variant
has a literal `_tag`, a `message`, and typed contextual properties:

```ts
class UnknownFieldError extends TaggedError('UnknownFieldError')<{
    fieldId: string
    message: string
}> {}
```

Actions return unions of these classes in their `Result` error branch. The same
tagged classes provide normal `Error` behavior, exhaustive tag matching, and
serialization support.

Tagged-error `message` values are stable developer-facing diagnostics and are
not localized. The component that owns the failed interaction maps `_tag` to
localized user-facing copy and interpolates the error's typed context fields.

Expose operation-specific mutation state separately from lifecycle, selection,
active configuration, and results. Compound components select only the pending
operation and target information needed for their presentation.

Do not serialize server mutations through a provider-wide mutex and do not add
a `MutationInProgressError`. The shipped compound components disable saved-list
mutation controls while any saved-list mutation is pending and continue to show
the initiating component's pending or error presentation. Public commands make
no additional guarantee for overlapping programmatic mutation calls; each
operation is reconciled through its normal canonical server confirmation.

For the simplest mutation semantics, the shipped compound components also
disable all configuration controls while any saved-list mutation is pending.
This includes columns, filters, program stage, and sorting. The configuration
therefore remains equal to the snapshot captured when create or update starts,
so mutation confirmation requires no reconciliation with edits made in flight.
Pagination and read-only result interaction may remain available. Public
programmatic configuration commands are not given an additional mutation-time
guard.

## Actions

Actions validate their complete candidate before committing. Commit state only
after successful validation, and return validation failures as tagged errors.
Use `better-result` for tagged command results and Zod at runtime validation
boundaries.

Convert expected invalid commands, permission failures, missing resources,
network failures, and malformed DHIS2 responses into declared tagged errors.
Programming defects and violated internal invariants remain thrown exceptions
for the application error boundary and monitoring.

Synchronous state commands return `Result<void, OperationError>`. Components
observe committed state through selector hooks rather than receiving duplicate
configuration snapshots. Saved-list mutations return:

```ts
createSavedList(name): Promise<
    Result<{ savedListId: string }, CreateSavedListError>
>
updateSelectedSavedList(): Promise<
    Result<void, UpdateSelectedSavedListError>
>
deleteSavedList(id): Promise<Result<void, DeleteSavedListError>>
```

Creation returns the server-generated saved-list ID. Updating the selected list
and deleting a target list return no success payload; their committed effects
are observed through selectors.

Sharing and stale-list repair are private provider workflows. They are not
exposed by `useWorkingListActions()` and their operation state is not part of
the public mutation meta. The shipped `WorkingList.SavedViews` and
`WorkingList.Results` components access them through private provider
interfaces.

```ts
downloadVisibleRows(): Result<void, DownloadVisibleRowsError>
```

`downloadVisibleRows` generates the existing CSV from the currently rendered
page and visible columns using provider-owned metadata and formatting context.
`WorkingList.Actions` keeps the download control in its current menu location
and displays any tagged failure returned by the action.

### Filters

```ts
setFilter(filter)
removeFilter(fieldId)
```

Both commands reset pagination to page 1. `setFilter` is an upsert. Removing a
known field that is not applied is an idempotent success. An unknown metadata ID
is an error.

### Columns and sorting

```ts
setColumns(fieldIds)
setSort(sort)
```

`setColumns` replaces the complete ordered column list and preserves the
current page. `setSort` replaces the sort and resets pagination to page 1.

### Program stage

```ts
setProgramStage(programStageId?)
```

A valid ID enters that event stage. `undefined` returns to tracked-entity mode.
Selecting the current stage is an idempotent success. Unknown or inaccessible
stages return a tagged error.

### Pagination

```ts
setPage(page)
setPageSize(pageSize: WorkingListPageSize)
```

The provider receives controlled pagination and its persistence callback:

```ts
export const WORKING_LIST_PAGE_SIZES = [10, 15, 25, 50, 100] as const

type WorkingListPageSize = (typeof WORKING_LIST_PAGE_SIZES)[number]

interface WorkingListPaginationProps {
    pagination: {
        page: number
        pageSize: WorkingListPageSize
    }
    onPaginationChange(next: {
        page: number
        pageSize: WorkingListPageSize
    }): void
}
```

The application chooses where to persist pagination. Lower-level components
read effective pagination from meta and call `setPage` or `setPageSize` through
the actions hook. Page must be a positive integer. Page size must be one of
`WORKING_LIST_PAGE_SIZES`; the shipped pagination UI uses that same tuple for
its options. Changing page size also resets page to 1.

Pagination is strictly controlled. The supplied `pagination` value is
authoritative. Pagination actions and provider-owned page resets stage the next
value synchronously and invoke `onPaginationChange`. On a subsequent render, a
supplied value that differs from the staged value wins, supersedes the staged
transition, and becomes the effective query pagination. Completion from a
superseded pagination request is ignored.

Provider render throws a descriptive developer error when controlled `page` is
not a positive integer or `pageSize` is not in `WORKING_LIST_PAGE_SIZES`. A
positive page beyond the server's current last page is not clamped or written
back; it produces an ordinary ready result with no rows.

The provider owns every pagination reset rule. Filter, sorting, stage, and
saved-list actions coordinate their configuration change and page-1 reset as a
single provider operation. The provider stages the effective next pagination
synchronously, invokes `onPaginationChange`, and uses that effective value for
the next result query while the parent persists it. A differing controlled prop
on the next render overrides that staged value. Each new configuration is
therefore fetched from its intended authoritative page.

### Saved lists

```ts
selectSavedList(id)
clearSavedListSelection()
createSavedList(name)
updateSelectedSavedList()
deleteSavedList(id)
```

`selectSavedList` requires `WorkingList.SavedViews` to complete dirty-state
discard confirmation before calling it. The action stages the requested ID,
immediately clears active configuration and results, resets pagination, enters
selection loading, and invokes `onSelectedSavedListChange`. After validation,
the provider atomically commits configuration, baseline, dirty state, effective
selected-list identity, and pagination. An external controlled-prop change does
not call this action; it is authoritative and begins the same transition without
discard confirmation.

`clearSavedListSelection` restores and selects the generated default, resets
pagination, clears dirty state, and persists the generated default's ID through
the selection callback.

Clicking the currently selected Saved Views pill invokes
`clearSavedListSelection` after any required dirty-state discard confirmation.
This preserves the existing way to return to the unfiltered generated default,
which is intentionally not rendered as its own pill.

`createSavedList` snapshots the current in-memory configuration. It remains
pending until the canonical saved-list query confirms the created resource.
`WorkingList.Actions` keeps the create button in its loading state during that
operation. The provider does not add a provisional saved-list entry or change
selection while the operation is pending. Once confirmed, the provider selects
the new resource and marks its snapshot as the clean baseline. Creation is
available for generated defaults and persisted lists, including a clean
persisted list.

A 2xx create response whose resource is absent from the refreshed canonical
query violates the backend contract and returns a tagged invalid-response error
while leaving the current selection unchanged. The provider does not poll.

`updateSelectedSavedList` requires an active persisted selection with compatible
resource type and write and update access. It snapshots the current in-memory
configuration into that selected list and remains pending until the canonical
saved-list query confirms the submitted configuration. The provider then
establishes the submitted configuration as the selected list's clean baseline.
A missing or mismatched resource is a tagged invalid-response error, and the
current configuration remains dirty.

`deleteSavedList` remains pending until the canonical saved-list query confirms
that the resource is absent. A resource still present after a successful delete
response is a tagged invalid-response error. Confirmed deletion of the selected
list restores the generated default; confirmed deletion of another list leaves
the current Working List state unchanged.

Saved-list actions validate the target list, resource type, compatibility, and
permissions before mutation.

## Saved-list workflows

When the saved-list query returns no accessible persisted views, Saved Views
renders the three generated tracked-entity views: Active enrollments, Completed
enrollments, and Cancelled enrollments. Their stable IDs, enrollment-status
filters, ordering, and localized labels preserve the current behavior. Generated
views expose no update, sharing, or deletion controls.

When at least one accessible persisted view exists, Saved Views renders the
persisted views and suppresses all three generated status views. If persisted
views later become inaccessible or are all deleted, the generated status views
return after the canonical saved-list query confirms that none remain.

The unfiltered generated default is separate from the three visible generated
status views. It retains its stable program-derived ID and remains the reset and
fallback target, but it is not added to the Saved Views pills.

The save UI exposes both updating the current persisted list and creating a new
list from the current configuration. A read-only shared list can be copied into
a new list. Updating requires write and update access. Sharing and deletion are
shown according to their corresponding permissions.

Sharing remains a private provider workflow presented by
`WorkingList.SavedViews`. Its dialog owns interaction errors. After a successful
sharing change, the provider refreshes the canonical saved-list query so
permissions and normalized list metadata are confirmed before they are exposed.

Stale saved-list repair remains an internal provider workflow presented by
`WorkingList.Results`. Selecting an incompatible list clears the previous
active configuration and results and enters a blocking selection error.
`WorkingList.Results` shows the existing repair table so the user can review
safe repairs. Confirming repair persists the repaired saved list, atomically
commits it as the active configuration, and starts its result query after the
mutation succeeds. A non-repairable list remains in the blocking error state.

## Results and queries

Keep TanStack Query keys private. The provider presents the combined queries as
normalized Working List meta.

Query placeholder data may be retained only during a background refresh for the
same effective selected saved-list ID. A selected-ID change never carries
configuration, results, or placeholder data across the transition.

Do not prefetch the next results page. The provider fetches a page only when it
becomes the effective controlled pagination request. Navigating to an uncached
page enters the normal Results loading presentation.

Queries retain the existing automatic retry policy: transient operational and
server failures retry up to twice, while Zod failures, deterministic boundary
failures, and HTTP 4xx responses fail immediately. Mutations do not retry.

After automatic retries are exhausted, `WorkingList.SavedViews` retains the
existing manual “Try again” control for saved-list query errors and
`WorkingList.Results` retains it for result-query errors. Retry uses a private
provider refetch interface and is not exposed by `useWorkingListActions()`.
Initialization errors remain blocking and expose no in-place retry control.

Expose pagination meta without requesting server totals:

```ts
interface WorkingListPaginationMeta {
    page: number
    pageSize: WorkingListPageSize
    displayedCount: number
    hasNextPage: boolean
}
```

The provider exposes no total count or page count and never estimates them.
`displayedCount` is the number of rendered rows.

For DHIS2 42 and newer, use `pager.nextPage` for authoritative next-page state.
For DHIS2 41, use the full-page heuristic:

```ts
hasNextPage = records.length === pageSize
```

## Provider lifecycle

A program change creates a fresh Working List store and resets the complete
provider lifecycle. An organisation-unit change preserves the selected list and
configuration, resets pagination to page 1, and refetches results. It does not
reset component-local menus, dialogs, confirmation targets, or unapplied filter
controls. A program change remounts the Working List internals and therefore
clears that local presentation state as part of the full reset.

## React version

Implement the composition with React 18 APIs. Context providers use the
standard `.Provider` form.
