import type {
    AppliedFilter,
    ConfigurationCommandError,
    CreateViewError,
    DeleteViewError,
    FilterOperator,
    FilterValue,
    PaginationCommandError,
    SelectViewError,
    UpdateSelectedViewError,
    WorkingListActions,
    WorkingListColumnSelectorProps,
    WorkingListConfiguration,
    WorkingListDataQualityMode,
    WorkingListDisplayRow,
    WorkingListFilterControlsProps,
    WorkingListMeta,
    WorkingListPageSize,
    WorkingListPagination,
    WorkingListProps,
    WorkingListResultTarget,
    WorkingListSort,
    WorkingListState,
    WorkingListToolbarProps,
    WorkingListToolbarActionsProps,
    WorkingListTableProps,
    WorkingListView,
    WorkingListViewSwitcherProps,
} from '..'
import { WorkingList } from '..'

export type SupportedWorkingListTypes = [
    AppliedFilter,
    ConfigurationCommandError,
    CreateViewError,
    DeleteViewError,
    FilterOperator,
    FilterValue,
    PaginationCommandError,
    SelectViewError,
    UpdateSelectedViewError,
    WorkingListActions,
    WorkingListColumnSelectorProps,
    WorkingListConfiguration,
    WorkingListDataQualityMode,
    WorkingListDisplayRow,
    WorkingListFilterControlsProps,
    WorkingListMeta,
    WorkingListPageSize,
    WorkingListPagination,
    WorkingListProps,
    WorkingListResultTarget,
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

// Nested slices are intentionally available through the aggregate contracts,
// not as additional names on the public entry point.
// @ts-expect-error WorkingListActiveConfigurationMeta is private.
export type { WorkingListActiveConfigurationMeta } from '..'
// @ts-expect-error WorkingListLifecycleMeta is private.
export type { WorkingListLifecycleMeta } from '..'
// @ts-expect-error WorkingListMutationMeta is private.
export type { WorkingListMutationMeta } from '..'
// @ts-expect-error WorkingListMutationStatus is private.
export type { WorkingListMutationStatus } from '..'
// @ts-expect-error WorkingListPaginationMeta is private.
export type { WorkingListPaginationMeta } from '..'
// @ts-expect-error WorkingListResultsMeta is private.
export type { WorkingListResultsMeta } from '..'
// @ts-expect-error WorkingListSavedView is private.
export type { WorkingListSavedView } from '..'
// @ts-expect-error WorkingListSavedViewsMeta is private.
export type { WorkingListSavedViewsMeta } from '..'
// @ts-expect-error WorkingListSelectionMeta is private.
export type { WorkingListSelectionMeta } from '..'

// These partial-prop aliases duplicated fields already named by the provider
// contract and were never consumed by the repository or registry test app.
// @ts-expect-error WorkingListPaginationProps is not a public alias.
export type { WorkingListPaginationProps } from '..'
// @ts-expect-error WorkingListSelectionProps is not a public alias.
export type { WorkingListSelectionProps } from '..'

// Removed composition and saved-list compatibility names are intentionally not
// part of the canonical entry point.
// @ts-expect-error WorkingListProviderProps is not public.
export type { WorkingListProviderProps } from '..'
// @ts-expect-error WorkingListContainerProps is not public.
export type { WorkingListContainerProps } from '..'
// @ts-expect-error WorkingListSectionProps is not public.
export type { WorkingListSectionProps } from '..'
// @ts-expect-error WorkingListDefaultProps is not public.
export type { WorkingListDefaultProps } from '..'
// @ts-expect-error WorkingListResultsProps is not public.
export type { WorkingListResultsProps } from '..'
// @ts-expect-error SelectSavedListError is not public.
export type { SelectSavedListError } from '..'
// @ts-expect-error CreateSavedListError is not public.
export type { CreateSavedListError } from '..'
// @ts-expect-error UpdateSelectedSavedListError is not public.
export type { UpdateSelectedSavedListError } from '..'
// @ts-expect-error DeleteSavedListError is not public.
export type { DeleteSavedListError } from '..'

export const legacyControlledRootProps: WorkingListProps = {
    children: null,
    programId: 'Program0001',
    orgUnitId: 'OrgUnit00001',
    // @ts-expect-error Legacy controlled view props are not accepted.
    selectedSavedListId: 'SavedList01',
    onSelectedSavedListChange: () => undefined,
}

declare const actions: WorkingListActions
// @ts-expect-error Saved-list action aliases are not exposed.
actions.selectSavedList('SavedList01')

// @ts-expect-error The provider is owned by the root and is not a compound member.
export const legacyProviderMember = WorkingList.Provider
// @ts-expect-error The container is owned by the root and is not a compound member.
export const legacyContainerMember = WorkingList.Container
// @ts-expect-error Legacy default composition is not exposed.
export const legacyDefaultMember = WorkingList.Default
// @ts-expect-error Legacy results composition is not exposed.
export const legacyResultsMember = WorkingList.Results
