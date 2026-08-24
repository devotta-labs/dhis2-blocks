import type { Result } from 'better-result'
import type { WorkingListCapabilities } from '../api/capabilities'
import type { ProgramFieldCatalog } from '../api/metadata'
import type { TrackerProgram } from '../api/schemas'
import type { WorkingListSystemInfo } from '../api/systemInfo'
import type {
    FilterOperator,
    FilterValue,
    WorkingListField,
    WorkingListSort,
} from '../domain/model'
import type {
    WorkingListRowIssue,
    WorkingListRowValues,
} from '../query/normalizeRows'
import type {
    ConfigurationCommandError,
    CreateSavedListError,
    DeleteSavedListError,
    DownloadVisibleRowsError,
    IncompatibleSavedListError,
    PaginationCommandError,
    SavedListNotFoundError,
    SelectSavedListError,
    UpdateSelectedSavedListError,
    WorkingListInitializationError,
    WorkingListInvalidResponseError,
    WorkingListNetworkError,
    WorkingListResultsError,
} from './errors'

export const WORKING_LIST_PAGE_SIZES = [10, 15, 25, 50, 100] as const

export type WorkingListPageSize = (typeof WORKING_LIST_PAGE_SIZES)[number]

export interface WorkingListPagination {
    page: number
    pageSize: WorkingListPageSize
}

export interface AppliedFilter {
    fieldId: string
    operator: FilterOperator
    value: FilterValue
}

interface WorkingListConfigurationBase {
    filters: AppliedFilter[]
    columns: string[]
    sort: WorkingListSort
}

export type WorkingListConfiguration =
    | (WorkingListConfigurationBase & {
          mode: 'trackedEntity'
          programStageId?: never
      })
    | (WorkingListConfigurationBase & {
          mode: 'event'
          programStageId: string
      })

export interface WorkingListState {
    selectedSavedListId: string
    configuration: WorkingListConfiguration
}

export type WorkingListResultTarget =
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

export interface WorkingListDisplayRow {
    id: string
    trackedEntityId?: string
    eventId?: string
    enrollmentId?: string
    values: WorkingListRowValues
    issues: ReadonlyArray<WorkingListRowIssue>
}

export interface WorkingListPaginationMeta extends WorkingListPagination {
    displayedCount: number
    hasNextPage: boolean
}

export type WorkingListLifecycleMeta =
    | { status: 'pending' }
    | { status: 'error'; error: WorkingListInitializationError }
    | { status: 'ready' }

export type WorkingListSelectionMeta =
    | { status: 'pending'; requestedSavedListId?: string }
    | {
          status: 'error'
          requestedSavedListId: string
          error: SavedListNotFoundError | IncompatibleSavedListError
      }
    | { status: 'ready'; selectedSavedListId: string }

export type WorkingListActiveConfigurationMeta =
    | { status: 'unavailable' }
    | { status: 'ready' }

export interface WorkingListSavedView {
    id: string
    name: string
    generated: boolean
    compatible: boolean
    canUpdate: boolean
    canDelete: boolean
    canShare: boolean
}

export type WorkingListSavedViewsMeta =
    | { status: 'pending'; views: readonly WorkingListSavedView[] }
    | {
          status: 'error'
          views: readonly WorkingListSavedView[]
          error: WorkingListNetworkError | WorkingListInvalidResponseError
      }
    | {
          status: 'ready'
          views: readonly WorkingListSavedView[]
          usingGeneratedViews: boolean
          isUpdating: boolean
      }

export type WorkingListResultsMeta =
    | { status: 'pending' }
    | { status: 'error'; error: WorkingListResultsError }
    | {
          status: 'ready'
          rows: readonly WorkingListDisplayRow[]
          pagination: WorkingListPaginationMeta
          isUpdating: boolean
      }

export type WorkingListMutationStatus =
    | { status: 'idle' }
    | { status: 'pending'; targetId?: string }

export interface WorkingListMutationMeta {
    create: WorkingListMutationStatus
    update: WorkingListMutationStatus
    delete: WorkingListMutationStatus
}

export interface WorkingListMeta {
    lifecycle: WorkingListLifecycleMeta
    selection: WorkingListSelectionMeta
    activeConfiguration: WorkingListActiveConfigurationMeta
    savedViews: WorkingListSavedViewsMeta
    mutations: WorkingListMutationMeta
    results: WorkingListResultsMeta
    dirty: boolean
    online: boolean
    pagination: WorkingListPagination
    program?: TrackerProgram
    systemInfo?: WorkingListSystemInfo
    capabilities?: WorkingListCapabilities
    fieldCatalog?: ProgramFieldCatalog
    fields: readonly WorkingListField[]
}

export interface WorkingListActions {
    setFilter(filter: AppliedFilter): Result<void, ConfigurationCommandError>
    removeFilter(fieldId: string): Result<void, ConfigurationCommandError>
    setColumns(fieldIds: string[]): Result<void, ConfigurationCommandError>
    setSort(sort: WorkingListSort): Result<void, ConfigurationCommandError>
    setProgramStage(
        programStageId?: string
    ): Result<void, ConfigurationCommandError>
    setPage(page: number): Result<void, PaginationCommandError>
    setPageSize(
        pageSize: WorkingListPageSize
    ): Result<void, PaginationCommandError>
    selectSavedList(id: string): Result<void, SelectSavedListError>
    clearSavedListSelection(): Result<void, SelectSavedListError>
    createSavedList(
        name: string
    ): Promise<Result<{ savedListId: string }, CreateSavedListError>>
    updateSelectedSavedList(): Promise<
        Result<void, UpdateSelectedSavedListError>
    >
    deleteSavedList(id: string): Promise<Result<void, DeleteSavedListError>>
    downloadVisibleRows(): Result<void, DownloadVisibleRowsError>
}

export interface WorkingListProviderProps {
    children: React.ReactNode
    programId: string
    orgUnitId: string
    /** Omit or pass undefined to start from the generated default list. */
    selectedSavedListId?: string | undefined
    onSelectedSavedListChange(id: string): void
    pagination: WorkingListPagination
    onPaginationChange(next: WorkingListPagination): void
}
