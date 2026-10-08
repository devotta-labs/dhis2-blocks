import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { shouldRetryWorkingListRequest } from '../api/client'
import { fieldsForConfiguration } from '../api/metadata'
import { fetchSavedWorkingLists } from '../api/savedLists'
import { workingListQueryKeys } from '../query/keys'
import { WorkingListTextProvider } from '../ui/WorkingListText'
import {
    resolveSelectedSavedListId,
    resolvePublicConfiguration,
    toPublicConfiguration,
} from './configuration'
import type {
    WorkingListConfiguration,
    WorkingListMeta,
    WorkingListMutationStatus,
    WorkingListPagination,
    WorkingListSavedViewsMeta,
} from './contracts'
import { assertPagination, idleMutations, asSavedView } from './providerMeta'
import { toTransportError } from './errorNormalization'
import { useRuntimeWorkingListClient } from './engineAdapter'
import {
    useStableWorkingListActions,
    WorkingListPublicContext,
    type WorkingListSnapshot,
} from './WorkingListContext'
import { createWorkingListActions } from './actionCommands'
import type { WorkingListActionRuntime } from './actionRuntime'
import { useWorkingListResults } from './useWorkingListResults'
import { useWorkingListRepair } from './useWorkingListRepair'
import {
    resolveSelection,
    useWorkingListSelection,
} from './useWorkingListSelection'
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
        lifecycle,
        lifecycleReady,
    } = useWorkingListLifecycle({ client, programId })

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

    const confirmedLists = savedListsQuery.data
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

    const savedViewsError = useMemo(
        () =>
            savedListsQuery.error
                ? toTransportError(
                      savedListsQuery.error,
                      'Loading saved working lists'
                  )
                : undefined,
        [savedListsQuery.error]
    )

    const savedViews = useMemo<WorkingListSavedViewsMeta>(() => {
        const views = displayedLists.map((list) =>
            asSavedView(list, usingGeneratedLists)
        )

        if (savedViewsError) {
            return { status: 'error', views, error: savedViewsError }
        }

        if (!confirmedLists) return { status: 'pending', views }

        return {
            status: 'ready',
            views,
            usingGeneratedViews: usingGeneratedLists,
            isUpdating: savedListsQuery.isFetching,
        }
    }, [
        confirmedLists,
        displayedLists,
        savedListsQuery.isFetching,
        savedViewsError,
        usingGeneratedLists,
    ])

    const effectivePagination = pagination
    const onPaginationChangeRef = useRef(onPaginationChange)
    onPaginationChangeRef.current = onPaginationChange

    const stagePagination = useCallback(
        (next: WorkingListPagination) => onPaginationChangeRef.current(next),
        []
    )

    const {
        requestedId,
        selection,
        activeState,
        resolvedConfiguration,
        dirty,
        selectionGeneration,
        setDraft,
        selectSavedList,
    } = useWorkingListSelection({
        selectedSavedListId: effectiveSelectedSavedListId,
        onSelectedSavedListChange,
        defaultList,
        confirmedLists,
        defaultListId,
        metadata,
        displayedLists,
    })

    const fields = useMemo(
        () =>
            metadata
                ? Array.from(
                      (activeState
                          ? fieldsForConfiguration(
                                metadata,
                                activeState.configuration
                            )
                          : metadata.fields
                      ).values()
                  )
                : [],
        [activeState, metadata]
    )

    const {
        pageQuery,
        organisationUnitLabelsQuery,
        formattingContext,
        resultTargets,
        results,
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
    })

    const refreshSavedLists = useCallback(async () => {
        if (!metadata) throw new Error('Program metadata is not ready')
        const queryKey = workingListQueryKeys.savedLists(programId)

        // Refetch in place: resetting the query would drop the last
        // successful snapshot and hide confirmed views when a refresh fails.
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

        return lists
    }, [client, metadata, parsingContext, programId, queryClient])

    const [mutations, setMutations] =
        useState<WorkingListMeta['mutations']>(idleMutations)

    const setMutation = useCallback(
        (
            operation: keyof WorkingListMeta['mutations'],
            status: WorkingListMutationStatus
        ) => setMutations((current) => ({ ...current, [operation]: status })),
        []
    )

    const runtime: WorkingListActionRuntime = {
        requestedId,
        activeState,
        resolvedConfiguration,
        metadata,
        serializationContext,
        formattingContext,
        confirmedLists,
        displayedLists,
        defaultList,
        selectionGeneration,
        effectivePagination,
        online,
        program,
        rows,
        results,
    }

    const runtimeRef = useRef(runtime)
    runtimeRef.current = runtime

    const transitionTo = useCallback(
        (id: string) => {
            selectSavedList(id)

            // React batches the transition; mirror the post-render selection
            // so commands issued in the same event compose on the newly
            // selected list instead of the stale one.
            const current = runtimeRef.current

            const { baseline } = resolveSelection({
                requestedId: id,
                defaultList: current.defaultList,
                confirmedLists: current.confirmedLists,
                defaultListId,
                metadata: current.metadata,
                displayedLists: current.displayedLists,
            })

            runtimeRef.current = {
                ...current,
                requestedId: id,
                activeState: baseline
                    ? {
                          selectedSavedListId: id,
                          configuration: toPublicConfiguration(
                              baseline.configuration
                          ),
                      }
                    : undefined,
                resolvedConfiguration: baseline?.configuration,
            }

            stagePagination({
                page: 1,
                pageSize: current.effectivePagination.pageSize,
            })
        },
        [defaultListId, selectSavedList, stagePagination]
    )

    const validateAndCommit = useCallback(
        (configuration: WorkingListConfiguration, resetPage: boolean) => {
            const current = runtimeRef.current

            if (!current.metadata || !current.activeState) {
                throw new Error('Working List configuration is unavailable')
            }

            const resolved = resolvePublicConfiguration({
                configuration,
                programId,
                metadata: current.metadata,
                serializationContext: current.serializationContext,
            })

            if (resolved.isErr()) return resolved

            setDraft({
                savedListId: current.activeState.selectedSavedListId,
                configuration,
                resolved: resolved.value,
            })

            // React batches setDraft; keep the runtime synchronously current
            // so back-to-back commands in one event compose on the candidate
            // just committed instead of the last render's configuration.
            runtimeRef.current = {
                ...current,
                activeState: {
                    selectedSavedListId:
                        current.activeState.selectedSavedListId,
                    configuration,
                },
                resolvedConfiguration: resolved.value,
                results: { status: 'pending' },
            }

            if (resetPage) {
                stagePagination({
                    page: 1,
                    pageSize: current.effectivePagination.pageSize,
                })
            }

            return Result.ok()
        },
        [programId, setDraft, stagePagination]
    )

    const currentActions = useMemo(
        () =>
            createWorkingListActions({
                runtimeRef,
                capabilities,
                client,
                defaultListId,
                selectSavedList: transitionTo,
                refreshSavedLists,
                setMutation,
                stagePagination,
                translate,
                validateAndCommit,
            }),
        [
            capabilities,
            client,
            defaultListId,
            refreshSavedLists,
            setMutation,
            stagePagination,
            transitionTo,
            translate,
            validateAndCommit,
        ]
    )

    const actions = useStableWorkingListActions(currentActions)

    const selectedId = requestedId

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
            retrySavedViews: savedListsQuery.refetch,
            retryPage: pageQuery.refetch,
            organisationUnitLabelsError: organisationUnitLabelsQuery.error,
            retryOrganisationUnitLabels: organisationUnitLabelsQuery.refetch,
        })

    const mutationBusy =
        Object.values(mutations).some(
            (mutation) => mutation.status === 'pending'
        ) || repairPending

    const meta = useMemo<WorkingListMeta>(
        () => ({
            lifecycle,
            selection,
            activeConfiguration: activeState
                ? { status: 'ready' }
                : { status: 'unavailable' },
            savedViews,
            mutations,
            results,
            dirty,
            online,
            pagination: effectivePagination,
            program,
            systemInfo,
            capabilities,
            fieldCatalog: metadata,
            fields,
        }),
        [
            activeState,
            capabilities,
            dirty,
            effectivePagination,
            fields,
            lifecycle,
            metadata,
            mutations,
            online,
            program,
            results,
            savedViews,
            selection,
            systemInfo,
        ]
    )

    const snapshot = useMemo<WorkingListSnapshot>(
        () => ({ activeState, meta }),
        [activeState, meta]
    )

    const publicContext = useMemo(
        () => ({ snapshot, actions }),
        [actions, snapshot]
    )

    const privateContext = useMemo<WorkingListPrivateUiContextValue>(
        () => ({
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
