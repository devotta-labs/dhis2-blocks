import type {
    AppliedFilter,
    ConfigurationCommandError,
    CreateViewError,
    CreateSavedListError,
    DeleteViewError,
    DeleteSavedListError,
    FilterOperator,
    FilterValue,
    PaginationCommandError,
    SelectSavedListError,
    SelectViewError,
    UpdateSelectedViewError,
    UpdateSelectedSavedListError,
    WorkingListActions,
    WorkingListColumnSelectorProps,
    WorkingListConfiguration,
    WorkingListContainerProps,
    WorkingListDataQualityMode,
    WorkingListDefaultProps,
    WorkingListDisplayRow,
    WorkingListFilterControlsProps,
    WorkingListMeta,
    WorkingListPageSize,
    WorkingListPagination,
    WorkingListProps,
    WorkingListProviderProps,
    WorkingListResultsProps,
    WorkingListResultTarget,
    WorkingListSectionProps,
    WorkingListSort,
    WorkingListState,
    WorkingListToolbarProps,
    WorkingListToolbarActionsProps,
    WorkingListTableProps,
    WorkingListView,
    WorkingListViewSwitcherProps,
} from '../src'

export type SupportedWorkingListTypes = [
    AppliedFilter,
    ConfigurationCommandError,
    CreateViewError,
    CreateSavedListError,
    DeleteViewError,
    DeleteSavedListError,
    FilterOperator,
    FilterValue,
    PaginationCommandError,
    SelectSavedListError,
    SelectViewError,
    UpdateSelectedViewError,
    UpdateSelectedSavedListError,
    WorkingListActions,
    WorkingListColumnSelectorProps,
    WorkingListConfiguration,
    WorkingListContainerProps,
    WorkingListDataQualityMode,
    WorkingListDefaultProps,
    WorkingListDisplayRow,
    WorkingListFilterControlsProps,
    WorkingListMeta,
    WorkingListPageSize,
    WorkingListPagination,
    WorkingListProps,
    WorkingListProviderProps,
    WorkingListResultsProps,
    WorkingListResultTarget,
    WorkingListSectionProps,
    WorkingListSort,
    WorkingListState,
    WorkingListToolbarProps,
    WorkingListToolbarActionsProps,
    WorkingListTableProps,
    WorkingListView,
    WorkingListViewSwitcherProps,
]

export const uncontrolledRootProps: WorkingListProps = {
    children: null,
    programId: 'Program0001',
    orgUnitId: 'OrgUnit00001',
}

export const defaultedRootProps: WorkingListProps = {
    children: null,
    programId: 'Program0001',
    orgUnitId: 'OrgUnit00001',
    defaultViewId: 'View00000001',
    onViewChange: () => undefined,
    defaultPagination: { page: 1, pageSize: 25 },
    onPaginationChange: () => undefined,
}

export const controlledRootProps: WorkingListProps = {
    children: null,
    programId: 'Program0001',
    orgUnitId: 'OrgUnit00001',
    viewId: null,
    onViewChange: () => undefined,
    pagination: { page: 2, pageSize: 15 },
    onPaginationChange: () => undefined,
}

// @ts-expect-error A controlled view requires its change callback.
export const controlledViewWithoutCallback: WorkingListProps = {
    children: null,
    programId: 'Program0001',
    orgUnitId: 'OrgUnit00001',
    viewId: 'View00000001',
}

// @ts-expect-error Controlled pagination requires its change callback.
export const controlledPaginationWithoutCallback: WorkingListProps = {
    children: null,
    programId: 'Program0001',
    orgUnitId: 'OrgUnit00001',
    pagination: { page: 2, pageSize: 15 },
}

// @ts-expect-error Controlled and uncontrolled view props cannot be combined.
export const conflictingViewModes: WorkingListProps = {
    children: null,
    programId: 'Program0001',
    orgUnitId: 'OrgUnit00001',
    viewId: 'View00000001',
    defaultViewId: 'View00000002',
    onViewChange: () => undefined,
}

const providerProps = (
    selectedSavedListId: string | null
): WorkingListProviderProps => ({
    children: null,
    programId: 'Program0001',
    orgUnitId: 'OrgUnit00001',
    selectedSavedListId,
    onSelectedSavedListChange: () => undefined,
    pagination: { page: 1, pageSize: 15 },
    onPaginationChange: () => undefined,
})

type SelectionIsRequired = WorkingListProviderProps extends {
    selectedSavedListId: string | null
}
    ? true
    : false

export const selectionIsRequired: SelectionIsRequired = true

// Both a preselected saved-list ID and null are supported.
export const supportedSelectionInputs = [
    providerProps('SavedList01'),
    providerProps(null),
]

// @ts-expect-error undefined is not a supported selection value.
export const unsupportedUndefinedSelection = providerProps(undefined)

// Nested slices are intentionally available through the aggregate contracts,
// not as additional names on the public entry point.
// @ts-expect-error WorkingListActiveConfigurationMeta is private.
export type { WorkingListActiveConfigurationMeta } from '../src'
// @ts-expect-error WorkingListLifecycleMeta is private.
export type { WorkingListLifecycleMeta } from '../src'
// @ts-expect-error WorkingListMutationMeta is private.
export type { WorkingListMutationMeta } from '../src'
// @ts-expect-error WorkingListMutationStatus is private.
export type { WorkingListMutationStatus } from '../src'
// @ts-expect-error WorkingListPaginationMeta is private.
export type { WorkingListPaginationMeta } from '../src'
// @ts-expect-error WorkingListResultsMeta is private.
export type { WorkingListResultsMeta } from '../src'
// @ts-expect-error WorkingListSavedView is private.
export type { WorkingListSavedView } from '../src'
// @ts-expect-error WorkingListSavedViewsMeta is private.
export type { WorkingListSavedViewsMeta } from '../src'
// @ts-expect-error WorkingListSelectionMeta is private.
export type { WorkingListSelectionMeta } from '../src'

// These partial-prop aliases duplicated fields already named by the provider
// contract and were never consumed by the repository or registry test app.
// @ts-expect-error WorkingListPaginationProps is not a public alias.
export type { WorkingListPaginationProps } from '../src'
// @ts-expect-error WorkingListSelectionProps is not a public alias.
export type { WorkingListSelectionProps } from '../src'
