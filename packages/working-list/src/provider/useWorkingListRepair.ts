import { Result } from 'better-result'
import { useMemo, useState } from 'react'
import type { WorkingListCapabilities } from '../api/capabilities'
import type { WorkingListClient } from '../api/client'
import type { ProgramFieldCatalog } from '../api/metadata'
import {
    repairSavedWorkingList,
    replaceSavedWorkingList,
    type NormalizedSavedWorkingList,
} from '../api/savedLists'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import type {
    FilterParsingContext,
    FilterSerializationContext,
} from '../registry/valueTypes'
import {
    internalConfigurationFingerprint,
    isCurrentSelection,
} from './configuration'
import { toTransportError } from './errorNormalization'
import {
    IncompatibleSavedListError,
    NoSelectedSavedListError,
    OfflineMutationError,
    SavedListPermissionError,
    WorkingListInvalidResponseError,
    type UpdateSelectedSavedListError,
} from './errors'
import { createSavedListRepairPlan } from './repair'
import type { WorkingListPrivateActions } from './WorkingListPrivateContext'

interface UseWorkingListRepairOptions {
    selectedId?: string
    selectedList?: NormalizedSavedWorkingList
    metadata?: ProgramFieldCatalog
    programId: string
    parsingContext?: FilterParsingContext
    serializationContext?: FilterSerializationContext
    online: boolean
    capabilities: WorkingListCapabilities
    client: WorkingListClient
    refreshSavedLists: () => Promise<NormalizedSavedWorkingList[]>
    latestRequestedIdRef: { current?: string }
    commitSelection: (id: string, configuration: InternalConfiguration) => void
    retrySavedViews: () => Promise<object>
    retryPage: () => Promise<object>
    organisationUnitLabelsError: unknown
    retryOrganisationUnitLabels: () => Promise<object>
}

export const useWorkingListRepair = ({
    selectedId,
    selectedList,
    metadata,
    programId,
    parsingContext,
    serializationContext,
    online,
    capabilities,
    client,
    refreshSavedLists,
    latestRequestedIdRef,
    commitSelection,
    retrySavedViews,
    retryPage,
    organisationUnitLabelsError,
    retryOrganisationUnitLabels,
}: UseWorkingListRepairOptions) => {
    const [repairPending, setRepairPending] = useState(false)
    const repairComputation = useMemo(() => {
        if (
            !metadata ||
            !selectedList ||
            selectedList.compatibility !== 'incompatible'
        ) {
            return undefined
        }
        const plan = createSavedListRepairPlan(selectedList, metadata)
        const result = repairSavedWorkingList({
            list: selectedList,
            decisions: plan.decisions,
            programId,
            metadata,
            parsingContext,
            serializationContext,
        })
        const expectedResource =
            result.status === 'repaired'
                ? result.configuration.mode === 'event'
                    ? 'programStageWorkingLists'
                    : 'trackedEntityInstanceFilters'
                : undefined
        return {
            plan,
            result,
            canRepair:
                online &&
                !repairPending &&
                selectedList.sharing.access?.write === true &&
                selectedList.sharing.access.update === true &&
                result.status === 'repaired' &&
                expectedResource === selectedList.resource,
        }
    }, [
        metadata,
        online,
        parsingContext,
        programId,
        repairPending,
        selectedList,
        serializationContext,
    ])

    const privateActions = useMemo<WorkingListPrivateActions>(
        () => ({
            async retrySavedViews() {
                await retrySavedViews()
            },
            async retryResults() {
                await Promise.all([
                    retryPage(),
                    organisationUnitLabelsError
                        ? retryOrganisationUnitLabels()
                        : Promise.resolve(),
                ])
            },
            async sharingSaved() {
                await refreshSavedLists()
            },
            async repairSelectedSavedList(): Promise<
                Result<void, UpdateSelectedSavedListError>
            > {
                if (!online) {
                    return Result.err(
                        new OfflineMutationError({
                            message:
                                'Working lists cannot be repaired while offline',
                        })
                    )
                }
                if (!selectedId || !selectedList || !metadata) {
                    return Result.err(
                        new NoSelectedSavedListError({
                            message:
                                'No saved working list is selected for repair',
                        })
                    )
                }
                if (selectedList.compatibility === 'compatible') {
                    return Result.ok()
                }
                if (
                    selectedList.sharing.access?.write !== true ||
                    selectedList.sharing.access.update !== true
                ) {
                    return Result.err(
                        new SavedListPermissionError({
                            savedListId: selectedId,
                            operation: 'update',
                            message: `Update access to ${selectedId} is required to repair it`,
                        })
                    )
                }
                if (
                    !repairComputation ||
                    repairComputation.result.status !== 'repaired'
                ) {
                    return Result.err(
                        new IncompatibleSavedListError({
                            savedListId: selectedId,
                            message:
                                'The saved working list cannot be repaired automatically',
                        })
                    )
                }
                const repaired = repairComputation.result.configuration
                const expectedResource =
                    repaired.mode === 'event'
                        ? 'programStageWorkingLists'
                        : 'trackedEntityInstanceFilters'
                if (expectedResource !== selectedList.resource) {
                    return Result.err(
                        new IncompatibleSavedListError({
                            savedListId: selectedId,
                            message:
                                'Repair would change the saved-list resource type',
                        })
                    )
                }
                setRepairPending(true)
                try {
                    await replaceSavedWorkingList({
                        client,
                        id: selectedId,
                        resource: selectedList.resource,
                        existingResource: selectedList.raw,
                        name: selectedList.name,
                        configuration: repaired,
                        fields: metadata.fields,
                        capabilities,
                        sharing: selectedList.sharing,
                        serializationContext,
                    })
                    const lists = await refreshSavedLists()
                    const confirmed = lists.find(
                        (list) => list.id === selectedId
                    )
                    if (
                        !confirmed ||
                        confirmed.compatibility !== 'compatible' ||
                        internalConfigurationFingerprint(
                            confirmed.configuration
                        ) !== internalConfigurationFingerprint(repaired)
                    ) {
                        return Result.err(
                            new WorkingListInvalidResponseError({
                                operation: 'repairSelectedSavedList',
                                message: `Repaired saved list ${selectedId} did not match the submitted repair after canonical refresh`,
                            })
                        )
                    }
                    if (
                        isCurrentSelection(
                            latestRequestedIdRef.current,
                            selectedId
                        )
                    ) {
                        commitSelection(selectedId, confirmed.configuration)
                    }
                    return Result.ok()
                } catch (cause) {
                    return Result.err(
                        toTransportError(
                            cause,
                            'Repairing the saved working list'
                        )
                    )
                } finally {
                    setRepairPending(false)
                }
            },
        }),
        [
            capabilities,
            client,
            commitSelection,
            metadata,
            online,
            organisationUnitLabelsError,
            retryOrganisationUnitLabels,
            retryPage,
            refreshSavedLists,
            repairComputation,
            retrySavedViews,
            selectedId,
            selectedList,
            serializationContext,
        ]
    )

    return { privateActions, repairComputation, repairPending }
}
