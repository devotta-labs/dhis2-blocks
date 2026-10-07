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
import type {
    WorkingListProviderStore,
    WorkingListProviderStoreState,
} from './store'

export interface WorkingListActionRuntime {
    activeState?: WorkingListState
    resolvedConfiguration?: InternalConfiguration
    metadata?: ProgramFieldCatalog
    serializationContext?: FilterSerializationContext
    formattingContext?: CellFormattingContext
    confirmedLists?: NormalizedSavedWorkingList[]
    displayedLists: readonly NormalizedSavedWorkingList[]
    effectivePagination: WorkingListPagination
    online: boolean
    program?: TrackerProgram
    rows: readonly WorkingListDisplayRow[]
}

export interface CreateWorkingListActionsOptions {
    runtimeRef: { current: WorkingListActionRuntime }
    selectionToken: { current: number }
    capabilities: WorkingListCapabilities
    client: WorkingListClient
    defaultListId: string
    hardTransition: (id: string, notify: boolean) => void
    refreshSavedLists: () => Promise<NormalizedSavedWorkingList[]>
    setMutation: (
        operation: keyof WorkingListMeta['mutations'],
        status: WorkingListMutationStatus
    ) => void
    stagePagination: (next: WorkingListPagination) => void
    store: WorkingListProviderStore
    translate: WorkingListTranslate
    updateStore: (
        update: (
            current: WorkingListProviderStoreState
        ) => Partial<WorkingListProviderStoreState>
    ) => void
    validateAndCommit: (
        configuration: WorkingListConfiguration,
        resetPage: boolean
    ) => ReturnType<WorkingListActionImplementation['setColumns']>
}
