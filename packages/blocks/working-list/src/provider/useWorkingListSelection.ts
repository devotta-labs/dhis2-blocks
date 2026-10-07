import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import type { ProgramFieldCatalog } from '../api/metadata'
import type { NormalizedSavedWorkingList } from '../api/savedLists'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import {
    publicConfigurationFingerprint,
    shouldBeginControlledSelection,
    toPublicConfiguration,
} from './configuration'
import type { WorkingListPagination } from './contracts'
import { IncompatibleSavedListError, SavedListNotFoundError } from './errors'
import type {
    WorkingListProviderStore,
    WorkingListProviderStoreState,
} from './store'

interface UseWorkingListSelectionOptions {
    selectedSavedListId: string
    onSelectedSavedListChange: (id: string) => void
    defaultList?: Extract<
        NormalizedSavedWorkingList,
        { compatibility: 'compatible' }
    >
    confirmedLists?: NormalizedSavedWorkingList[]
    defaultListId: string
    metadata?: ProgramFieldCatalog
    displayedLists: readonly NormalizedSavedWorkingList[]
    stagePagination: (next: WorkingListPagination) => void
    store: WorkingListProviderStore
    updateStore: (
        update: (
            current: WorkingListProviderStoreState
        ) => Partial<WorkingListProviderStoreState>
    ) => void
}

export const useWorkingListSelection = ({
    selectedSavedListId,
    onSelectedSavedListChange,
    defaultList,
    confirmedLists,
    defaultListId,
    metadata,
    displayedLists,
    stagePagination,
    store,
    updateStore,
}: UseWorkingListSelectionOptions) => {
    const [transitionId, setTransitionId] = useState<string>()
    const requestedId = transitionId ?? selectedSavedListId
    const selectionToken = useRef(0)
    const latestRequestedIdRef = useRef<string | undefined>(selectedSavedListId)
    const onSelectionChangeRef = useRef(onSelectedSavedListChange)
    onSelectionChangeRef.current = onSelectedSavedListChange

    const hardTransition = useCallback(
        (id: string, notify: boolean) => {
            selectionToken.current += 1
            latestRequestedIdRef.current = id
            setTransitionId(id)
            updateStore((current) => ({
                activeState: undefined,
                resolvedConfiguration: undefined,
                baselineFingerprint: undefined,
                meta: {
                    ...current.meta,
                    selection: {
                        status: 'pending',
                        requestedSavedListId: id,
                    },
                    activeConfiguration: { status: 'unavailable' },
                    dirty: false,
                    results: { status: 'pending' },
                },
            }))
            stagePagination({
                page: 1,
                pageSize: store.getState().meta.pagination.pageSize,
            })

            if (notify) onSelectionChangeRef.current(id)
        },
        [stagePagination, store, updateStore]
    )

    const previousControlledId = useRef<string>()
    // EFFECT: WorkingListStore.selection -- Apply host-controlled selection to the vanilla store before paint, including external navigation changes.
    useLayoutEffect(() => {
        if (
            !shouldBeginControlledSelection(
                previousControlledId.current,
                selectedSavedListId
            )
        ) {
            return
        }

        previousControlledId.current = selectedSavedListId

        if (selectedSavedListId && selectedSavedListId !== transitionId) {
            hardTransition(selectedSavedListId, false)
        }
    }, [hardTransition, selectedSavedListId, transitionId])

    // Clear the optimistic request when the controlled host acknowledges it.
    // This adjusts only this component's state before committing its render.
    if (transitionId !== undefined && selectedSavedListId === transitionId) {
        setTransitionId(undefined)
    }

    const commitSelection = useCallback(
        (id: string, internal: InternalConfiguration) => {
            const configuration = toPublicConfiguration(internal)
            updateStore((current) => ({
                activeState: { selectedSavedListId: id, configuration },
                resolvedConfiguration: internal,
                baselineFingerprint:
                    publicConfigurationFingerprint(configuration),
                meta: {
                    ...current.meta,
                    selection: { status: 'ready', selectedSavedListId: id },
                    activeConfiguration: { status: 'ready' },
                    dirty: false,
                    results: { status: 'pending' },
                },
            }))

            if (selectedSavedListId === id) {
                setTransitionId(undefined)
            }
        },
        [selectedSavedListId, updateStore]
    )

    // EFFECT: WorkingListStore.selection -- Resolve a pending store selection after server lists and metadata arrive; event handlers cannot resolve unavailable data.
    useEffect(() => {
        if (!confirmedLists || !defaultList || !requestedId || !metadata) return

        if (latestRequestedIdRef.current !== requestedId) return
        const current = store.getState()

        if (
            current.activeState?.selectedSavedListId === requestedId &&
            current.meta.selection.status === 'ready'
        ) {
            return
        }

        const token = selectionToken.current

        const target =
            requestedId === defaultListId
                ? defaultList
                : displayedLists.find((list) => list.id === requestedId)

        if (!target) {
            updateStore((current) => ({
                activeState: undefined,
                resolvedConfiguration: undefined,
                baselineFingerprint: undefined,
                meta: {
                    ...current.meta,
                    selection: {
                        status: 'error',
                        requestedSavedListId: requestedId,
                        error: new SavedListNotFoundError({
                            savedListId: requestedId,
                            message: `Saved working list ${requestedId} was not found`,
                        }),
                    },
                    activeConfiguration: { status: 'unavailable' },
                    results: { status: 'pending' },
                },
            }))

            return
        }

        if (target.compatibility === 'incompatible') {
            updateStore((current) => ({
                activeState: undefined,
                resolvedConfiguration: undefined,
                baselineFingerprint: undefined,
                meta: {
                    ...current.meta,
                    selection: {
                        status: 'error',
                        requestedSavedListId: requestedId,
                        error: new IncompatibleSavedListError({
                            savedListId: requestedId,
                            message: `Saved working list ${requestedId} is incompatible with current metadata`,
                        }),
                    },
                    activeConfiguration: { status: 'unavailable' },
                    results: { status: 'pending' },
                },
            }))

            return
        }

        if (token === selectionToken.current) {
            commitSelection(requestedId, target.configuration)
        }
    }, [
        commitSelection,
        confirmedLists,
        defaultList,
        defaultListId,
        displayedLists,
        metadata,
        requestedId,
        store,
        updateStore,
    ])

    // Same-id passive refresh updates metadata only. It invalidates the active
    // context if the selected server resource disappears or becomes stale.
    // EFFECT: WorkingListStore.selection -- Invalidate the active store configuration when a passive server refresh removes or changes its saved view.
    useEffect(() => {
        const active = store.getState().activeState

        if (!active || !confirmedLists) return
        const id = active.selectedSavedListId

        if (id === defaultListId) return
        const refreshed = displayedLists.find((list) => list.id === id)

        if (!refreshed || refreshed.compatibility === 'incompatible') {
            hardTransition(id, false)
        }
    }, [confirmedLists, defaultListId, displayedLists, hardTransition, store])

    return {
        requestedId,
        selectionToken,
        latestRequestedIdRef,
        hardTransition,
        commitSelection,
    }
}
