import type { WorkingListCapabilities } from '../api/capabilities'
import type { WorkingListClient } from '../api/client'
import type { ProgramFieldCatalog } from '../api/metadata'
import type { NormalizedSavedWorkingList } from '../api/savedLists'
import type { TrackerProgram } from '../api/schemas'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import type {
    CellFormattingContext,
    FilterSerializationContext,
} from '../registry/valueTypes'
import type { WorkingListTranslate } from '../ui/WorkingListText'
import type {
    WorkingListActionImplementation,
    WorkingListConfiguration,
    WorkingListDisplayRow,
    WorkingListMeta,
    WorkingListMutationStatus,
    WorkingListPagination,
    WorkingListState,
} from './contracts'

export interface WorkingListActionRuntime {
    requestedId: string
    activeState?: WorkingListState
    resolvedConfiguration?: InternalConfiguration
    metadata?: ProgramFieldCatalog
    serializationContext?: FilterSerializationContext
    formattingContext?: CellFormattingContext
    confirmedLists?: NormalizedSavedWorkingList[]
    displayedLists: readonly NormalizedSavedWorkingList[]
    defaultList?: Extract<
        NormalizedSavedWorkingList,
        { compatibility: 'compatible' }
    >
    selectionGeneration: { current: number }
    effectivePagination: WorkingListPagination
    online: boolean
    program?: TrackerProgram
    rows: readonly WorkingListDisplayRow[]
    results: WorkingListMeta['results']
}

export interface CreateWorkingListActionsOptions {
    runtimeRef: { current: WorkingListActionRuntime }
    capabilities: WorkingListCapabilities
    client: WorkingListClient
    defaultListId: string
    selectSavedList: (id: string) => void
    refreshSavedLists: () => Promise<NormalizedSavedWorkingList[]>
    setMutation: (
        operation: keyof WorkingListMeta['mutations'],
        status: WorkingListMutationStatus
    ) => void
    stagePagination: (next: WorkingListPagination) => void
    translate: WorkingListTranslate
    validateAndCommit: (
        configuration: WorkingListConfiguration,
        resetPage: boolean
    ) => ReturnType<WorkingListActionImplementation['setColumns']>
}
