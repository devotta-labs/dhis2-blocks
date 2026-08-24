/**
 * Public entry point for the installed Working List source block.
 *
 * Aggregate contracts are named here; nested state and meta slices can be
 * derived from `WorkingListState` and `WorkingListMeta` when consumers need a
 * reusable local alias.
 */
export {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
    type WorkingListProps,
    type WorkingListTableProps,
    type WorkingListViewSwitcherProps,
    type WorkingListColumnSelectorProps,
    type WorkingListFilterControlsProps,
    type WorkingListToolbarActionsProps,
    type WorkingListContainerProps,
    type WorkingListDefaultProps,
    type WorkingListResultsProps,
    type WorkingListSectionProps,
    type WorkingListToolbarProps,
} from './ui'
export type { WorkingListDataQualityMode } from './ui/types'

export {
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from './provider/WorkingListContext'
export { WORKING_LIST_PAGE_SIZES } from './provider/contracts'
export type {
    AppliedFilter,
    WorkingListActions,
    WorkingListConfiguration,
    WorkingListDisplayRow,
    WorkingListMeta,
    WorkingListPageSize,
    WorkingListPagination,
    WorkingListProviderProps,
    WorkingListResultTarget,
    WorkingListState,
    WorkingListView,
} from './provider/contracts'

export {
    DownloadVisibleRowsError,
    IncompatibleSavedListError,
    InvalidConfigurationError,
    InvalidPaginationError,
    NoSelectedSavedListError,
    OfflineMutationError,
    SavedListNotFoundError,
    SavedListPermissionError,
    UnknownFieldError,
    UnknownProgramStageError,
    WorkingListInitializationError,
    WorkingListInvalidResponseError,
    WorkingListNetworkError,
    WorkingListResultsError,
} from './provider/errors'
export type {
    ConfigurationCommandError,
    CreateViewError,
    CreateSavedListError,
    DeleteViewError,
    DeleteSavedListError,
    PaginationCommandError,
    SelectSavedListError,
    SelectViewError,
    UpdateSelectedViewError,
    UpdateSelectedSavedListError,
} from './provider/errors'

export type {
    FilterOperator,
    FilterValue,
    WorkingListSort,
} from './domain/model'
