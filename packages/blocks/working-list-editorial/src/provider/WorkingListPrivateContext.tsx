import React, { createContext, useContext } from 'react'
import type { Result } from 'better-result'
import type { WorkingListCapabilities } from '../api/capabilities'
import type { WorkingListClient } from '../api/client'
import type { ProgramFieldCatalog } from '../api/metadata'
import type { NormalizedSavedWorkingList } from '../api/savedLists'
import type { TrackerProgram } from '../api/schemas'
import type { WorkingListSystemInfo } from '../api/systemInfo'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import type {
    CellFormattingContext,
    FilterParsingContext,
    FilterSerializationContext,
} from '../registry/valueTypes'
import type { WorkingListTranslate } from '../ui/WorkingListText'
import type { SavedListRepairPlan } from './repair'
import type {
    UpdateSelectedViewError,
    WorkingListInvalidResponseError,
    WorkingListNetworkError,
} from './errors'
import type { WorkingListActions, WorkingListResultTarget } from './contracts'
import type { WorkingListProviderStore } from './store'

interface WorkingListPrivateCalendarContext {
    calendar: WorkingListSystemInfo['calendar']
    dateFormat: WorkingListSystemInfo['dateFormat']
    locale: string
    timeZone: string
}

export interface WorkingListPrivateActions {
    retrySavedViews(): Promise<void>
    retryResults(): Promise<void>
    sharingSaved(): Promise<void>
    repairSelectedSavedList(): Promise<Result<void, UpdateSelectedViewError>>
}

export interface WorkingListPrivateUiContextValue {
    store: WorkingListProviderStore
    actions: WorkingListActions
    privateActions: WorkingListPrivateActions
    client: WorkingListClient
    programId: string
    orgUnitId: string
    online: boolean
    locale: string
    translate: WorkingListTranslate
    program?: TrackerProgram
    systemInfo?: WorkingListSystemInfo
    capabilities: WorkingListCapabilities
    metadata?: ProgramFieldCatalog
    calendarContext?: WorkingListPrivateCalendarContext
    parsingContext?: FilterParsingContext
    serializationContext?: FilterSerializationContext
    formattingContext?: CellFormattingContext
    resolvedConfiguration?: InternalConfiguration
    confirmedLists?: readonly NormalizedSavedWorkingList[]
    displayedLists: readonly NormalizedSavedWorkingList[]
    selectedList?: NormalizedSavedWorkingList
    defaultList?: Extract<
        NormalizedSavedWorkingList,
        { compatibility: 'compatible' }
    >
    selectedIsGenerated: boolean
    mutationBusy: boolean
    repair?: {
        plan: SavedListRepairPlan
        repairedConfiguration?: InternalConfiguration
        canRepair: boolean
        isPending: boolean
    }
    resultTargets: ReadonlyMap<string, WorkingListResultTarget>
    savedViewsQueryError?:
        | WorkingListNetworkError
        | WorkingListInvalidResponseError
}

export const WorkingListPrivateUiContext =
    createContext<WorkingListPrivateUiContextValue | null>(null)

export const useWorkingListPrivateUi = (): WorkingListPrivateUiContextValue => {
    const context = useContext(WorkingListPrivateUiContext)
    if (!context) {
        throw new Error(
            'useWorkingListPrivateUi must be used within WorkingList.'
        )
    }
    return context
}
