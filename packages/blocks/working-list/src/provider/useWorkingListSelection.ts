import { useCallback, useMemo, useRef, useState } from 'react'
import type { ProgramFieldCatalog } from '../api/metadata'
import type { NormalizedSavedWorkingList } from '../api/savedLists'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import {
    publicConfigurationFingerprint,
    toPublicConfiguration,
} from './configuration'
import type {
    WorkingListConfiguration,
    WorkingListSelectionMeta,
    WorkingListState,
} from './contracts'
import { IncompatibleSavedListError, SavedListNotFoundError } from './errors'

type CompatibleSavedList = Extract<
    NormalizedSavedWorkingList,
    { compatibility: 'compatible' }
>

/** Local edits to the selected list, kept apart from the server baseline. */
export interface WorkingListDraft {
    savedListId: string
    configuration: WorkingListConfiguration
    resolved: InternalConfiguration
}

interface ResolvedSelection {
    meta: WorkingListSelectionMeta
    baseline?: CompatibleSavedList
}

interface UseWorkingListSelectionOptions {
    selectedSavedListId: string
    onSelectedSavedListChange: (id: string) => void
    defaultList?: CompatibleSavedList
    confirmedLists?: NormalizedSavedWorkingList[]
    defaultListId: string
    metadata?: ProgramFieldCatalog
    displayedLists: readonly NormalizedSavedWorkingList[]
}

export const resolveSelection = ({
    requestedId,
    defaultList,
    confirmedLists,
    defaultListId,
    metadata,
    displayedLists,
}: Omit<
    UseWorkingListSelectionOptions,
    'selectedSavedListId' | 'onSelectedSavedListChange'
> & { requestedId: string }): ResolvedSelection => {
    if (!confirmedLists || !defaultList || !metadata) {
        return {
            meta: { status: 'pending', requestedSavedListId: requestedId },
        }
    }

    const target =
        requestedId === defaultListId
            ? defaultList
            : displayedLists.find((list) => list.id === requestedId)

    if (!target) {
        return {
            meta: {
                status: 'error',
                requestedSavedListId: requestedId,
                error: new SavedListNotFoundError({
                    savedListId: requestedId,
                    message: `Saved working list ${requestedId} was not found`,
                }),
            },
        }
    }

    if (target.compatibility === 'incompatible') {
        return {
            meta: {
                status: 'error',
                requestedSavedListId: requestedId,
                error: new IncompatibleSavedListError({
                    savedListId: requestedId,
                    message: `Saved working list ${requestedId} is incompatible with current metadata`,
                }),
            },
        }
    }

    return {
        meta: { status: 'ready', selectedSavedListId: requestedId },
        baseline: target,
    }
}

/**
 * Derives the active selection from the controlled id and the server lists.
 * Only an optimistic transition and the user's draft are local state, so
 * host navigation, late-arriving lists and passive refreshes need no
 * synchronization: the next render resolves them.
 */
export const useWorkingListSelection = ({
    selectedSavedListId,
    onSelectedSavedListChange,
    defaultList,
    confirmedLists,
    defaultListId,
    metadata,
    displayedLists,
}: UseWorkingListSelectionOptions) => {
    const onSelectionChangeRef = useRef(onSelectedSavedListChange)
    onSelectionChangeRef.current = onSelectedSavedListChange
    const selectedSavedListIdRef = useRef(selectedSavedListId)
    selectedSavedListIdRef.current = selectedSavedListId

    // A local selection shows immediately, until the host acknowledges it or
    // navigates elsewhere.
    const [transition, setTransition] = useState<{
        id: string
        from: string
    }>()

    if (transition && transition.from !== selectedSavedListId) {
        setTransition(undefined)
    }

    const requestedId =
        transition?.from === selectedSavedListId
            ? transition.id
            : selectedSavedListId

    // Count every transition — optimistic and host-driven — so async
    // mutations can tell whether the selection moved since they started.
    const selectionGenerationRef = useRef(0)
    const lastRequestedIdRef = useRef(requestedId)

    if (lastRequestedIdRef.current !== requestedId) {
        lastRequestedIdRef.current = requestedId
        selectionGenerationRef.current += 1
    }

    const { meta: selection, baseline } = useMemo(
        () =>
            resolveSelection({
                requestedId,
                defaultList,
                confirmedLists,
                defaultListId,
                metadata,
                displayedLists,
            }),
        [
            confirmedLists,
            defaultList,
            defaultListId,
            displayedLists,
            metadata,
            requestedId,
        ]
    )

    const [draft, setDraft] = useState<WorkingListDraft>()

    // Edits belong to one selection; leaving it, or losing it to a refresh,
    // discards them.
    if (
        draft &&
        (draft.savedListId !== requestedId || selection.status === 'error')
    ) {
        setDraft(undefined)
    }

    const activeDraft = draft?.savedListId === requestedId ? draft : undefined

    const baselineConfiguration = useMemo(
        () => baseline && toPublicConfiguration(baseline.configuration),
        [baseline]
    )

    const activeState = useMemo<WorkingListState | undefined>(
        () =>
            baselineConfiguration && {
                selectedSavedListId: requestedId,
                configuration:
                    activeDraft?.configuration ?? baselineConfiguration,
            },
        [activeDraft, baselineConfiguration, requestedId]
    )

    const dirty = useMemo(
        () =>
            Boolean(
                activeDraft &&
                baselineConfiguration &&
                publicConfigurationFingerprint(activeDraft.configuration) !==
                    publicConfigurationFingerprint(baselineConfiguration)
            ),
        [activeDraft, baselineConfiguration]
    )

    const selectSavedList = useCallback((id: string) => {
        selectionGenerationRef.current += 1
        // Mark the optimistic request as counted so the render that applies
        // it does not advance the generation a second time.
        lastRequestedIdRef.current = id
        setDraft(undefined)
        setTransition({ id, from: selectedSavedListIdRef.current })
        onSelectionChangeRef.current(id)
    }, [])

    return {
        requestedId,
        selection,
        activeState,
        resolvedConfiguration: activeDraft?.resolved ?? baseline?.configuration,
        dirty,
        selectionGeneration: selectionGenerationRef,
        setDraft,
        selectSavedList,
    }
}
