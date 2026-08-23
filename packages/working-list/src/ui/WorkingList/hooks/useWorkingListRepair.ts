import { useMemo } from 'react'
import type { ProgramFieldCatalog } from '../../../api/metadata'
import {
    repairSavedWorkingList,
    type NormalizedSavedWorkingList,
} from '../../../api/savedLists'
import type {
    FilterParsingContext,
    FilterSerializationContext,
} from '../../../registry/valueTypes'
import { createSavedListRepairDecisions } from '../workingListModel'

interface WorkingListRepairOptions {
    selectedList?: NormalizedSavedWorkingList
    metadata: ProgramFieldCatalog
    programId: string
    parsingContext: FilterParsingContext
    serializationContext: FilterSerializationContext
    online: boolean
    mutationBusy: boolean
}

export const useWorkingListRepair = ({
    selectedList,
    metadata,
    programId,
    parsingContext,
    serializationContext,
    online,
    mutationBusy,
}: WorkingListRepairOptions) => {
    const plan = useMemo(
        () =>
            selectedList?.compatibility === 'incompatible'
                ? createSavedListRepairDecisions(selectedList, metadata)
                : undefined,
        [metadata, selectedList]
    )
    const result = useMemo(
        () =>
            selectedList?.compatibility === 'incompatible' && plan
                ? repairSavedWorkingList({
                      list: selectedList,
                      decisions: plan.decisions,
                      programId,
                      metadata,
                      parsingContext,
                      serializationContext,
                  })
                : undefined,
        [
            metadata,
            parsingContext,
            plan,
            programId,
            selectedList,
            serializationContext,
        ]
    )
    const access = selectedList?.sharing.access
    const repairedResource =
        result?.status === 'repaired'
            ? result.configuration.mode === 'event'
                ? 'programStageWorkingLists'
                : 'trackedEntityInstanceFilters'
            : undefined
    const canRepair =
        online &&
        !mutationBusy &&
        selectedList?.compatibility === 'incompatible' &&
        access?.write === true &&
        access.update === true &&
        result?.status === 'repaired' &&
        repairedResource === selectedList.resource

    return { plan, result, canRepair }
}
