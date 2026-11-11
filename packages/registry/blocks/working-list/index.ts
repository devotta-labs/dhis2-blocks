/**
 * Public entry point for the installed Working List source block.
 *
 * `useWorkingList` holds what the person has chosen (view, draft, page); the
 * query hooks load what the server holds for those choices, and the mutation
 * hooks save it.
 */
export {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListSelectionError,
    WorkingListViewSwitcher,
    type WorkingListProps,
    type WorkingListTableProps,
    type WorkingListViewSwitcherProps,
    type WorkingListColumnSelectorProps,
    type WorkingListFilterControlsProps,
    type WorkingListToolbarActionsProps,
    type WorkingListToolbarProps,
} from './ui'
export type { WorkingListDataQualityMode } from './ui/types'

export {
    useWorkingList,
    type WorkingListContextValue,
} from './provider/WorkingListContext'
export {
    useSavedLists,
    useWorkingListMetadata,
    useWorkingListRecords,
    useWorkingListView,
    type WorkingListMetadata,
    type WorkingListRecords,
    type WorkingListSelectedView,
} from './provider/queries'
export {
    useCreateSavedList,
    useDeleteSavedList,
    useRepairSavedList,
    useUpdateSavedList,
} from './provider/mutations'
export {
    useWorkingListDateBounds,
    useWorkingListDateRange,
} from './provider/useWorkingListDateRange'
export type {
    WorkingListDateBounds,
    WorkingListDatedRecord,
    WorkingListDateFieldId,
    WorkingListDateRangeOptions,
    WorkingListDateRangeResults,
} from './provider/useWorkingListDateRange'
export {
    TRACKER_ENROLLMENT_STATUSES,
    TRACKER_EVENT_STATUSES,
} from './api/schemas'
export { WORKING_LIST_PAGE_SIZES } from './provider/contracts'
export {
    getWorkingListRecordStatus,
    type WorkingListRecordStatus,
} from './provider/recordStatus'
export type {
    AppliedFilter,
    WorkingListConfiguration,
    WorkingListDisplayRow,
    WorkingListPageSize,
    WorkingListPagination,
    WorkingListResultTarget,
    WorkingListView,
} from './provider/contracts'

export {
    IncompatibleSavedListError,
    InvalidConfigurationError,
    NoSelectedSavedListError,
    OfflineMutationError,
    SavedListNotFoundError,
    SavedListPermissionError,
    UnknownFieldError,
    WorkingListInitializationError,
    WorkingListInvalidResponseError,
    WorkingListNetworkError,
    WorkingListResultsError,
} from './provider/errors'
export type {
    ConfigurationCommandError,
    CreateViewError,
    DeleteViewError,
    RepairSavedListError,
    UpdateSelectedViewError,
} from './provider/errors'

export type {
    FilterOperator,
    FilterValue,
    WorkingListSort,
} from './domain/model'
