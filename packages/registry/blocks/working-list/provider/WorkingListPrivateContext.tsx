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
import type { WorkingListTranslate } from '../domain/translation'
import type { SavedListRepairPlan } from './repair'
import type { UpdateSelectedViewError } from './errors'
import type { WorkingListResultTarget } from './contracts'

interface WorkingListPrivateCalendarContext {
    calendar: WorkingListSystemInfo['calendar']
    dateFormat: WorkingListSystemInfo['dateFormat']
    locale: string
    timeZone: string
}

interface WorkingListPrivateActions {
    retrySavedViews(): Promise<void>
    retryResults(): Promise<void>
    sharingSaved(): Promise<void>
    repairSelectedSavedList(): Promise<Result<void, UpdateSelectedViewError>>
}

export interface WorkingListPrivateUiContextValue {
    privateActions: WorkingListPrivateActions
    client: WorkingListClient
    programId: string
    orgUnitId: string
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
    displayedLists: readonly NormalizedSavedWorkingList[]
    selectedList?: NormalizedSavedWorkingList
    mutationBusy: boolean
    repair?: {
        plan: SavedListRepairPlan
        repairedConfiguration?: InternalConfiguration
        canRepair: boolean
        isPending: boolean
    }
    resultTargets: ReadonlyMap<string, WorkingListResultTarget>
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
