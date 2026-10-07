import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react'
import { shouldRetryWorkingListRequest } from '../api/client'
import { fieldsForConfiguration } from '../api/metadata'
import {
    fetchSavedWorkingLists,
    type NormalizedSavedWorkingList,
} from '../api/savedLists'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import { workingListQueryKeys } from '../query/keys'
import { WorkingListTextProvider } from '../ui/WorkingListText'
import {
    publicConfigurationFingerprint,
    resolveSelectedSavedListId,
    resolvePublicConfiguration,
    type toPublicConfiguration,
} from './configuration'
import type {
    WorkingListMeta,
    WorkingListMutationStatus,
    WorkingListPagination,
    WorkingListSavedViewsMeta,
} from './contracts'
import { assertPagination, initialMeta, asSavedView } from './providerMeta'
import { toTransportError } from './errorNormalization'
import { useRuntimeWorkingListClient } from './engineAdapter'
import {
    createWorkingListProviderStore,
    type WorkingListProviderStore,
} from './store'
import {
    useStableWorkingListActions,
    WorkingListPublicContext,
} from './WorkingListContext'
import { createWorkingListActions } from './actionCommands'
import type { WorkingListActionRuntime } from './actionRuntime'
import { useWorkingListResults } from './useWorkingListResults'
import { useWorkingListRepair } from './useWorkingListRepair'
import { useWorkingListSelection } from './useWorkingListSelection'
import { useWorkingListLifecycle } from './useWorkingListLifecycle'
import {
    WorkingListPrivateUiContext,
    type WorkingListPrivateUiContextValue,
} from './WorkingListPrivateContext'

interface WorkingListProviderProps {
    children: React.ReactNode
    programId: string
    orgUnitId: string
    selectedSavedListId: string | null
    onSelectedSavedListChange(id: string): void
    pagination: WorkingListPagination
    onPaginationChange(next: WorkingListPagination): void
}

const WorkingListProviderInstance = ({
    programId,
    orgUnitId,
    selectedSavedListId,
    onSelectedSavedListChange,
    pagination,
    onPaginationChange,
    children,
}: WorkingListProviderProps) => {
    assertPagination(pagination)
    const queryClient = useQueryClient()
    const client = useRuntimeWorkingListClient()

    const [store] = useState<WorkingListProviderStore>(() =>
        createWorkingListProviderStore(initialMeta(pagination))
    )

    const updateStore = useCallback(
        (
            update: (
                current: ReturnType<typeof store.getState>
            ) => Partial<ReturnType<typeof store.getState>>
        ) => store.setState((current) => update(current)),
        [store]
    )

    const {
        online,
        translate,
        locale,
        program,
        systemInfo,
        capabilities,
        metadata,
        parsingContext,
        serializationContext,
        calendarContext,
        defaultList,
        generatedLists,
        defaultListId,
        lifecycleReady,
    } = useWorkingListLifecycle({ client, programId, updateStore })

    const effectiveSelectedSavedListId = resolveSelectedSavedListId(
        selectedSavedListId,
        defaultListId
    )

    const savedListsQuery = useQuery({
        queryKey: workingListQueryKeys.savedLists(programId),
        queryFn: ({ signal }) => {
            if (!metadata) throw new Error('Program metadata is not ready')

            return fetchSavedWorkingLists({
                client,
                programId,
                metadata,
                parsingContext,
                signal,
            })
        },
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryWorkingListRequest,
        enabled: lifecycleReady,
    })

    const [confirmedLists, setConfirmedLists] =
        useState<NormalizedSavedWorkingList[]>()

    useEffect(() => {
        if (savedListsQuery.data) setConfirmedLists(savedListsQuery.data)
    }, [savedListsQuery.data])
    const usingGeneratedLists = confirmedLists?.length === 0

    const displayedLists = useMemo(
        () =>
            confirmedLists
                ? confirmedLists.length
                    ? confirmedLists
                    : generatedLists
                : [],
        [confirmedLists, generatedLists]
    )

    const savedViewsError = savedListsQuery.error
        ? toTransportError(savedListsQuery.error, 'Loading saved working lists')
        : undefined

    useEffect(() => {
        const views = displayedLists.map((list) =>
            asSavedView(list, Boolean(usingGeneratedLists))
        )

        let savedViews: WorkingListSavedViewsMeta

        if (savedViewsError) {
            savedViews = {
                status: 'error',
                views,
                error: savedViewsError,
            }
        } else if (!confirmedLists) {
            savedViews = savedViewsError
                ? { status: 'error', views, error: savedViewsError }
                : { status: 'pending', views }
        } else {
            savedViews = {
                status: 'ready',
                views,
                usingGeneratedViews: Boolean(usingGeneratedLists),
                isUpdating: savedListsQuery.isFetching,
            }
        }

        updateStore((current) => ({
            meta: { ...current.meta, savedViews },
        }))
    }, [
        confirmedLists,
        displayedLists,
        savedListsQuery.isFetching,
        savedViewsError,
        updateStore,
        usingGeneratedLists,
    ])

    const [stagedPagination, setStagedPagination] =
        useState<WorkingListPagination>()

    const effectivePagination = stagedPagination ?? pagination
    useLayoutEffect(() => {
        if (!stagedPagination) return
        setStagedPagination(undefined)
    }, [pagination, stagedPagination])
    useEffect(() => {
        updateStore((current) => ({
            meta: { ...current.meta, pagination: effectivePagination },
        }))
    }, [effectivePagination, updateStore])
    const onPaginationChangeRef = useRef(onPaginationChange)
    onPaginationChangeRef.current = onPaginationChange

    const stagePagination = useCallback(
        (next: WorkingListPagination) => {
            setStagedPagination(next)
            updateStore((current) => ({
                meta: { ...current.meta, pagination: next },
            }))
            onPaginationChangeRef.current(next)
        },
        [updateStore]
    )

    const {
        requestedId,
        selectionToken,
        latestRequestedIdRef,
        hardTransition,
        commitSelection,
    } = useWorkingListSelection({
        selectedSavedListId: effectiveSelectedSavedListId,
        onSelectedSavedListChange,
        defaultList,
        confirmedLists,
        defaultListId,
        metadata,
        displayedLists,
        stagePagination,
        store,
        updateStore,
    })

    const subscribe = useCallback(
        (notify: () => void) => store.subscribe(notify),
        [store]
    )

    const activeState = useSyncExternalStore(
        subscribe,
        () => store.getState().activeState
    )

    useEffect(() => {
        if (!activeState || !metadata) return

        const fields = Array.from(
            fieldsForConfiguration(metadata, activeState.configuration).values()
        )

        updateStore((current) => ({
            meta: { ...current.meta, fields },
        }))
    }, [activeState, metadata, updateStore])

    const resolvedConfiguration = useSyncExternalStore(
        subscribe,
        () => store.getState().resolvedConfiguration
    )

    const selectionMeta = useSyncExternalStore(
        subscribe,
        () => store.getState().meta.selection
    )

    const mutationMeta = useSyncExternalStore(
        subscribe,
        () => store.getState().meta.mutations
    )

    const {
        pageQuery,
        organisationUnitLabelsQuery,
        formattingContext,
        resultTargets,
        rows,
    } = useWorkingListResults({
        client,
        programId,
        orgUnitId,
        resolvedConfiguration,
        configuration: activeState?.configuration,
        metadata,
        effectivePagination,
        capabilities,
        serializationContext,
        systemInfo,
        locale,
        translate,
        online,
        stagePagination,
        store,
        updateStore,
    })

    const refreshSavedLists = useCallback(async () => {
        if (!metadata) throw new Error('Program metadata is not ready')
        const queryKey = workingListQueryKeys.savedLists(programId)
        await queryClient.resetQueries({ queryKey })

        const lists = await queryClient.fetchQuery({
            queryKey,
            queryFn: ({ signal }) =>
                fetchSavedWorkingLists({
                    client,
                    programId,
                    metadata,
                    parsingContext,
                    signal,
                }),
            staleTime: 0,
            retry: shouldRetryWorkingListRequest,
        })

        setConfirmedLists(lists)

        return lists
    }, [client, metadata, parsingContext, programId, queryClient])

    const setMutation = useCallback(
        (
            operation: keyof WorkingListMeta['mutations'],
            status: WorkingListMutationStatus
        ) =>
            updateStore((current) => ({
                meta: {
                    ...current.meta,
                    mutations: {
                        ...current.meta.mutations,
                        [operation]: status,
                    },
                },
            })),
        [updateStore]
    )

    const runtimeRef = useRef<WorkingListActionRuntime>({
        activeState,
        resolvedConfiguration,
        metadata,
        serializationContext,
        formattingContext,
        confirmedLists,
        displayedLists,
        effectivePagination,
        online,
        program,
        rows,
    })

    runtimeRef.current = {
        activeState,
        resolvedConfiguration,
        metadata,
        serializationContext,
        formattingContext,
        confirmedLists,
        displayedLists,
        effectivePagination,
        online,
        program,
        rows,
    }

    const commitConfiguration = useCallback(
        (
            configuration: ReturnType<typeof toPublicConfiguration>,
            internal: InternalConfiguration,
            resetPage: boolean
        ) => {
            updateStore((current) => ({
                activeState: current.activeState
                    ? { ...current.activeState, configuration }
                    : undefined,
                resolvedConfiguration: internal,
                meta: {
                    ...current.meta,
                    dirty:
                        publicConfigurationFingerprint(configuration) !==
                        current.baselineFingerprint,
                    results: { status: 'pending' },
                },
            }))

            if (resetPage) {
                stagePagination({
                    page: 1,
                    pageSize: store.getState().meta.pagination.pageSize,
                })
            }
        },
        [stagePagination, store, updateStore]
    )

    const validateAndCommit = useCallback(
        (
            configuration: ReturnType<typeof toPublicConfiguration>,
            resetPage: boolean
        ) => {
            const runtime = runtimeRef.current

            if (!runtime.metadata || !runtime.activeState) {
                throw new Error('Working List configuration is unavailable')
            }

            const resolved = resolvePublicConfiguration({
                configuration,
                programId,
                metadata: runtime.metadata,
                serializationContext: runtime.serializationContext,
            })

            if (resolved.isErr()) return resolved
            commitConfiguration(configuration, resolved.value, resetPage)

            return Result.ok()
        },
        [commitConfiguration, programId]
    )

    const currentActions = useMemo(
        () =>
            createWorkingListActions({
                runtimeRef,
                selectionToken,
                capabilities,
                client,
                defaultListId,
                hardTransition,
                refreshSavedLists,
                setMutation,
                stagePagination,
                store,
                translate,
                updateStore,
                validateAndCommit,
            }),
        [
            capabilities,
            client,
            defaultListId,
            hardTransition,
            refreshSavedLists,
            setMutation,
            stagePagination,
            store,
            translate,
            updateStore,
            validateAndCommit,
        ]
    )

    const actions = useStableWorkingListActions(currentActions)

    const selectedId =
        activeState?.selectedSavedListId ??
        (selectionMeta.status === 'error'
            ? selectionMeta.requestedSavedListId
            : requestedId)

    const selectedList = displayedLists.find((list) => list.id === selectedId)

    const { privateActions, repairComputation, repairPending } =
        useWorkingListRepair({
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
            retrySavedViews: savedListsQuery.refetch,
            retryPage: pageQuery.refetch,
            organisationUnitLabelsError: organisationUnitLabelsQuery.error,
            retryOrganisationUnitLabels: organisationUnitLabelsQuery.refetch,
        })

    const mutationBusy =
        Object.values(mutationMeta).some(
            (mutation) => mutation.status === 'pending'
        ) || repairPending

    const publicContext = useMemo(() => ({ store, actions }), [actions, store])

    const privateContext = useMemo<WorkingListPrivateUiContextValue>(
        () => ({
            store,
            actions,
            privateActions,
            client,
            programId,
            orgUnitId,
            online,
            locale,
            translate,
            program,
            systemInfo,
            capabilities,
            metadata,
            calendarContext,
            parsingContext,
            serializationContext,
            formattingContext,
            resolvedConfiguration,
            confirmedLists,
            displayedLists,
            selectedList,
            defaultList,
            selectedIsGenerated:
                selectedId === defaultListId || Boolean(usingGeneratedLists),
            mutationBusy,
            repair: repairComputation
                ? {
                      plan: repairComputation.plan,
                      repairedConfiguration:
                          repairComputation.result.status === 'repaired'
                              ? repairComputation.result.configuration
                              : undefined,
                      canRepair: repairComputation.canRepair,
                      isPending: repairPending,
                  }
                : undefined,
            resultTargets,
            savedViewsQueryError: savedViewsError,
        }),
        [
            actions,
            calendarContext,
            capabilities,
            client,
            confirmedLists,
            defaultList,
            defaultListId,
            displayedLists,
            formattingContext,
            locale,
            metadata,
            mutationBusy,
            online,
            orgUnitId,
            parsingContext,
            privateActions,
            program,
            programId,
            repairComputation,
            repairPending,
            resolvedConfiguration,
            resultTargets,
            savedViewsError,
            selectedId,
            selectedList,
            serializationContext,
            store,
            systemInfo,
            translate,
            usingGeneratedLists,
        ]
    )

    return (
        <WorkingListPublicContext.Provider value={publicContext}>
            <WorkingListPrivateUiContext.Provider value={privateContext}>
                {children}
            </WorkingListPrivateUiContext.Provider>
        </WorkingListPublicContext.Provider>
    )
}

export const WorkingListProvider = (props: WorkingListProviderProps) => (
    <WorkingListTextProvider>
        <WorkingListProviderInstance key={props.programId} {...props} />
    </WorkingListTextProvider>
)
