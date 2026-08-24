import { useConfig, useOnlineStatus } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { QueryClientContext, useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, {
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react'
import { z } from 'zod'
import {
    detectMetadataFeatures,
    resolveWorkingListCapabilities,
} from '../api/capabilities'
import { shouldRetryWorkingListRequest } from '../api/client'
import {
    buildProgramFieldCatalog,
    trackerProgramQueryOptions,
} from '../api/metadata'
import {
    createDefaultWorkingList,
    createGeneratedDefaultLists,
    createSavedWorkingList,
    defaultWorkingListId,
    deleteSavedWorkingList,
    fetchSavedWorkingLists,
    repairSavedWorkingList,
    replaceSavedWorkingList,
    type NormalizedSavedWorkingList,
} from '../api/savedLists'
import { workingListSystemInfoQueryOptions } from '../api/systemInfo'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import {
    workingListPageQueryOptions,
    type WorkingListPage,
} from '../query/fetchers'
import {
    collectFileResourceIds,
    createFileResourceNameResolver,
    fileResourceNamesQueryOptions,
} from '../query/fileResourceLabels'
import { workingListQueryKeys } from '../query/keys'
import {
    collectOrganisationUnitIds,
    createOrganisationUnitLabelResolver,
    organisationUnitLabelsQueryOptions,
} from '../query/referenceLabels'
import { DEFAULT_WORKING_LIST_SORT } from '../query/serialize'
import { createWorkingListValueTransformers } from '../registry/transformers'
import {
    WorkingListTextProvider,
    defaultWorkingListTranslate,
} from '../ui/WorkingListText'
import {
    IncompatibleSavedListError,
    InvalidConfigurationError,
    InvalidPaginationError,
    NoSelectedSavedListError,
    OfflineMutationError,
    SavedListNotFoundError,
    SavedListPermissionError,
    UnknownFieldError,
    UnknownProgramStageError,
    WorkingListInitializationError,
    WorkingListInvalidResponseError,
    DownloadVisibleRowsError,
    type UpdateSelectedSavedListError,
} from './errors'
import {
    canCommitMutationBaseline,
    internalConfigurationFingerprint,
    isCurrentSelection,
    publicConfigurationFingerprint,
    resolvePublicConfiguration,
    shouldBeginControlledSelection,
    toPublicConfiguration,
} from './configuration'
import type {
    AppliedFilter,
    WorkingListActions,
    WorkingListMeta,
    WorkingListMutationStatus,
    WorkingListPagination,
    WorkingListProviderProps,
    WorkingListSavedView,
    WorkingListSavedViewsMeta,
} from './contracts'
import { WORKING_LIST_PAGE_SIZES } from './contracts'
import { toResultsError, toTransportError } from './errorNormalization'
import { useRuntimeWorkingListClient } from './engineAdapter'
import {
    downloadRowsAsCsv,
    toDisplayRows,
    toPaginationMeta,
    toResultTargets,
} from './results'
import { createSavedListRepairPlan } from './repair'
import {
    createWorkingListProviderStore,
    type WorkingListProviderStore,
} from './store'
import {
    useStableWorkingListActions,
    WorkingListPublicContext,
} from './WorkingListContext'
import {
    WorkingListPrivateUiContext,
    type WorkingListPrivateActions,
    type WorkingListPrivateUiContextValue,
} from './WorkingListPrivateContext'

const RuntimeConfigSchema = z
    .object({ apiVersion: z.coerce.number().int().positive() })
    .passthrough()

const assertPagination = (pagination: WorkingListPagination) => {
    if (!Number.isInteger(pagination.page) || pagination.page < 1) {
        throw new Error(
            `WorkingList.Provider requires pagination.page to be a positive integer; received ${String(pagination.page)}`
        )
    }
    if (!WORKING_LIST_PAGE_SIZES.includes(pagination.pageSize)) {
        throw new Error(
            `WorkingList.Provider requires pagination.pageSize to be one of ${WORKING_LIST_PAGE_SIZES.join(', ')}; received ${String(pagination.pageSize)}`
        )
    }
}

const idleMutation = (): WorkingListMutationStatus => ({ status: 'idle' })

const initialMeta = (pagination: WorkingListPagination): WorkingListMeta => ({
    lifecycle: { status: 'pending' },
    selection: { status: 'pending' },
    activeConfiguration: { status: 'unavailable' },
    savedViews: { status: 'pending', views: [] },
    mutations: {
        create: idleMutation(),
        update: idleMutation(),
        delete: idleMutation(),
    },
    results: { status: 'pending' },
    dirty: false,
    online: true,
    pagination,
    fields: [],
})

const asSavedView = (
    list: NormalizedSavedWorkingList,
    generated: boolean
): WorkingListSavedView => ({
    id: list.id,
    name: list.name,
    generated,
    compatible: list.compatibility === 'compatible',
    canUpdate:
        !generated &&
        list.sharing.access?.write === true &&
        list.sharing.access.update === true,
    canDelete: !generated && list.sharing.access?.delete === true,
    canShare: !generated && list.sharing.access?.manage === true,
})

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
    const queryClient = useContext(QueryClientContext)
    if (!queryClient) {
        throw new Error(
            'WorkingList.Provider requires a host QueryClientProvider. Mount it beneath @tanstack/react-query QueryClientProvider.'
        )
    }
    const client = useRuntimeWorkingListClient()
    const config = useConfig()
    const runtimeConfig = useMemo(
        () => RuntimeConfigSchema.safeParse(config),
        [config]
    )
    const apiVersion = runtimeConfig.success
        ? runtimeConfig.data.apiVersion
        : 41
    const { online } = useOnlineStatus()
    const translate = defaultWorkingListTranslate
    const locale = i18n.language ?? globalThis.navigator?.language ?? 'en'

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

    const systemInfoQuery = useQuery(workingListSystemInfoQueryOptions(client))
    const programQuery = useQuery(
        trackerProgramQueryOptions(client, programId, apiVersion)
    )
    const program = programQuery.data
    const systemInfo = systemInfoQuery.data
    const capabilities = useMemo(
        () =>
            resolveWorkingListCapabilities({
                apiVersion,
                metadataFeatures: program
                    ? detectMetadataFeatures(program)
                    : undefined,
            }),
        [apiVersion, program]
    )
    const metadataResolution = useMemo(() => {
        if (
            !program ||
            !capabilities.supported ||
            program.programType !== 'WITH_REGISTRATION'
        ) {
            return {}
        }
        try {
            return {
                metadata: buildProgramFieldCatalog({
                    program,
                    capabilities,
                    hasSelectedOrgUnit: true,
                }),
            }
        } catch (cause) {
            return {
                error: new WorkingListInitializationError({
                    message: `Program ${programId} metadata could not be interpreted`,
                    cause,
                }),
            }
        }
    }, [capabilities, program, programId])
    const metadata = metadataResolution.metadata

    const lifecycleError = useMemo(() => {
        if (!runtimeConfig.success) {
            return new WorkingListInitializationError({
                message:
                    'DHIS2 runtime configuration did not contain a valid API version',
                cause: runtimeConfig.error,
            })
        }
        if (!capabilities.supported) {
            return new WorkingListInitializationError({
                message: `DHIS2 API version ${apiVersion} is unsupported; Working List requires version 41 or newer`,
            })
        }
        if (systemInfoQuery.error) {
            return new WorkingListInitializationError({
                message: 'DHIS2 system information could not be loaded',
                cause: systemInfoQuery.error,
            })
        }
        if (programQuery.error) {
            return new WorkingListInitializationError({
                message: `Program ${programId} metadata could not be loaded`,
                cause: programQuery.error,
            })
        }
        if (program && program.programType !== 'WITH_REGISTRATION') {
            return new WorkingListInitializationError({
                message: `Program ${programId} is not a tracker program with registration`,
            })
        }
        return metadataResolution.error
    }, [
        apiVersion,
        capabilities.supported,
        metadataResolution.error,
        program,
        programId,
        programQuery.error,
        runtimeConfig,
        systemInfoQuery.error,
    ])
    const lifecycleReady = Boolean(
        program && systemInfo && metadata && !lifecycleError
    )

    const valueTransformers = useMemo(
        () =>
            systemInfo
                ? createWorkingListValueTransformers({
                      systemInfo,
                      locale,
                      trueLabel: translate('Yes'),
                      falseLabel: translate('No'),
                  })
                : undefined,
        [locale, systemInfo, translate]
    )
    const parsingContext = valueTransformers?.parsingContext
    const serializationContext = valueTransformers?.serializationContext
    const calendarContext = useMemo(
        () =>
            systemInfo
                ? {
                      calendar: systemInfo.calendar,
                      dateFormat: systemInfo.dateFormat,
                      locale,
                      timeZone: systemInfo.serverTimeZoneId,
                  }
                : undefined,
        [locale, systemInfo]
    )

    const defaultList = useMemo(
        () =>
            metadata
                ? createDefaultWorkingList({
                      programId,
                      columns: metadata.defaultTrackedEntityColumns,
                  })
                : undefined,
        [metadata, programId]
    )
    const generatedLists = useMemo(
        () =>
            metadata
                ? createGeneratedDefaultLists({
                      programId,
                      columns: metadata.defaultTrackedEntityColumns,
                      fields: metadata.fields,
                  })
                : [],
        [metadata, programId]
    )
    const defaultListId = defaultWorkingListId(programId)

    useEffect(() => {
        updateStore((current) => ({
            meta: {
                ...current.meta,
                lifecycle: lifecycleError
                    ? { status: 'error', error: lifecycleError }
                    : lifecycleReady
                      ? { status: 'ready' }
                      : { status: 'pending' },
                online,
                program,
                systemInfo,
                capabilities,
                fieldCatalog: metadata,
                fields: metadata ? [...metadata.fields.values()] : [],
            },
        }))
    }, [
        capabilities,
        lifecycleError,
        lifecycleReady,
        metadata,
        online,
        program,
        systemInfo,
        updateStore,
    ])

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

    const controlledSelection = selectedSavedListId !== undefined
    const [uncontrolledSelection, setUncontrolledSelection] = useState<string>()
    const [transitionId, setTransitionId] = useState<string>()
    const requestedId =
        transitionId ??
        (controlledSelection ? selectedSavedListId : uncontrolledSelection)
    const selectionToken = useRef(0)
    const latestRequestedIdRef = useRef<string | undefined>(selectedSavedListId)
    const onSelectionChangeRef = useRef(onSelectedSavedListChange)
    onSelectionChangeRef.current = onSelectedSavedListChange

    const hardTransition = useCallback(
        (id: string, notify: boolean) => {
            selectionToken.current += 1
            latestRequestedIdRef.current = id
            setTransitionId(id)
            if (!controlledSelection) setUncontrolledSelection(id)
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
        [controlledSelection, stagePagination, store, updateStore]
    )

    const previousControlledId = useRef<string>()
    useLayoutEffect(() => {
        if (!controlledSelection) return
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
    }, [controlledSelection, hardTransition, selectedSavedListId, transitionId])

    useEffect(() => {
        if (
            controlledSelection &&
            transitionId !== undefined &&
            selectedSavedListId === transitionId
        ) {
            setTransitionId(undefined)
        }
    }, [controlledSelection, selectedSavedListId, transitionId])

    const initialSelectionNotified = useRef(false)
    useEffect(() => {
        if (!defaultList || !confirmedLists || requestedId) return
        if (!controlledSelection && !initialSelectionNotified.current) {
            initialSelectionNotified.current = true
            hardTransition(defaultListId, true)
        }
    }, [
        confirmedLists,
        controlledSelection,
        defaultList,
        defaultListId,
        hardTransition,
        requestedId,
    ])

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
            if (!controlledSelection || selectedSavedListId === id) {
                setTransitionId(undefined)
            }
        },
        [controlledSelection, selectedSavedListId, updateStore]
    )

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

    const subscribe = useCallback(
        (notify: () => void) => store.subscribe(notify),
        [store]
    )
    const activeState = useSyncExternalStore(
        subscribe,
        () => store.getState().activeState
    )
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

    const previousResultOrgUnitRef = useRef(orgUnitId)
    const pageQuery = useQuery({
        ...(resolvedConfiguration && metadata
            ? workingListPageQueryOptions({
                  client,
                  context: { programId, orgUnitId },
                  configuration: resolvedConfiguration,
                  pagination:
                      previousResultOrgUnitRef.current === orgUnitId
                          ? effectivePagination
                          : {
                                page: 1,
                                pageSize: effectivePagination.pageSize,
                            },
                  capabilities,
                  fields: metadata.fields,
                  serializationContext,
                  translate,
              })
            : {
                  queryKey: [...workingListQueryKeys.all, 'records', 'idle'],
                  queryFn: (): Promise<WorkingListPage> =>
                      Promise.reject(new Error('Results are not ready')),
              }),
        enabled: Boolean(resolvedConfiguration && metadata),
    })
    const pageData = pageQuery.data
    const rows = useMemo(() => toDisplayRows(pageData), [pageData])
    const organisationUnitIds = useMemo(
        () =>
            pageData && metadata
                ? collectOrganisationUnitIds(pageData, metadata.fields)
                : [],
        [metadata, pageData]
    )
    const organisationUnitLabelsQuery = useQuery({
        ...organisationUnitLabelsQueryOptions(client, organisationUnitIds),
        enabled: Boolean(pageData) && organisationUnitIds.length > 0,
    })
    const fileResourceIds = useMemo(
        () =>
            pageData && metadata
                ? collectFileResourceIds(pageData, metadata.fields)
                : [],
        [metadata, pageData]
    )
    const fileResourceNamesQuery = useQuery({
        ...fileResourceNamesQueryOptions(client, fileResourceIds),
        enabled: Boolean(pageData) && fileResourceIds.length > 0,
    })
    const organisationUnitLabelsReady =
        organisationUnitIds.length === 0 ||
        organisationUnitLabelsQuery.data !== undefined ||
        organisationUnitLabelsQuery.isSuccess
    const fileResourceNamesReady =
        fileResourceIds.length === 0 ||
        fileResourceNamesQuery.isSuccess ||
        fileResourceNamesQuery.isError
    const displayTransformers = useMemo(
        () =>
            systemInfo
                ? createWorkingListValueTransformers({
                      systemInfo,
                      locale,
                      trueLabel: translate('Yes'),
                      falseLabel: translate('No'),
                      resolveDisplayName: createOrganisationUnitLabelResolver(
                          organisationUnitLabelsQuery.data ?? new Map()
                      ),
                      resolveFileResourceName: createFileResourceNameResolver(
                          fileResourceNamesQuery.data ?? new Map()
                      ),
                  })
                : undefined,
        [
            fileResourceNamesQuery.data,
            locale,
            organisationUnitLabelsQuery.data,
            systemInfo,
            translate,
        ]
    )
    const formattingContext = displayTransformers?.formattingContext
    const resultsError =
        pageQuery.error && !(pageData && !online)
            ? pageQuery.error
            : organisationUnitLabelsQuery.error &&
                organisationUnitLabelsQuery.data === undefined
              ? organisationUnitLabelsQuery.error
              : undefined
    useEffect(() => {
        let results: WorkingListMeta['results']
        if (!resolvedConfiguration) {
            results = { status: 'pending' }
        } else if (resultsError) {
            results = { status: 'error', error: toResultsError(resultsError) }
        } else if (
            !pageData ||
            !organisationUnitLabelsReady ||
            !fileResourceNamesReady
        ) {
            results = { status: 'pending' }
        } else {
            results = {
                status: 'ready',
                rows,
                pagination: toPaginationMeta(pageData, rows.length),
                isUpdating:
                    (pageQuery.isFetching && !pageQuery.isPending) ||
                    organisationUnitLabelsQuery.isFetching ||
                    fileResourceNamesQuery.isFetching,
            }
        }
        updateStore((current) => ({ meta: { ...current.meta, results } }))
    }, [
        fileResourceNamesQuery.isFetching,
        fileResourceNamesReady,
        organisationUnitLabelsQuery.isFetching,
        organisationUnitLabelsReady,
        pageData,
        pageQuery.isFetching,
        pageQuery.isPending,
        resolvedConfiguration,
        resultsError,
        rows,
        updateStore,
    ])

    const resultTargets = useMemo(
        () =>
            toResultTargets({
                pageData,
                programId,
                configuration: activeState?.configuration,
            }),
        [activeState?.configuration, pageData, programId]
    )

    const previousOrgUnit = useRef(orgUnitId)
    useEffect(() => {
        if (previousOrgUnit.current === orgUnitId) return
        previousOrgUnit.current = orgUnitId
        previousResultOrgUnitRef.current = orgUnitId
        stagePagination({
            page: 1,
            pageSize: store.getState().meta.pagination.pageSize,
        })
    }, [orgUnitId, stagePagination, store])

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
    const runtimeRef = useRef({
        activeState,
        resolvedConfiguration,
        metadata,
        serializationContext,
        formattingContext,
        confirmedLists,
        displayedLists,
        defaultList,
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
        defaultList,
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

    const currentActions = useMemo<WorkingListActions>(
        () => ({
            setFilter(filter: AppliedFilter) {
                const runtime = runtimeRef.current
                if (!runtime.activeState)
                    throw new Error('Working List configuration is unavailable')
                const filters = runtime.activeState.configuration.filters
                return validateAndCommit(
                    {
                        ...runtime.activeState.configuration,
                        filters: filters.some(
                            (item) => item.fieldId === filter.fieldId
                        )
                            ? filters.map((item) =>
                                  item.fieldId === filter.fieldId
                                      ? filter
                                      : item
                              )
                            : [...filters, filter],
                    },
                    true
                )
            },
            removeFilter(fieldId) {
                const runtime = runtimeRef.current
                if (!runtime.activeState || !runtime.metadata)
                    throw new Error('Working List configuration is unavailable')
                if (!runtime.metadata.fields.has(fieldId)) {
                    return Result.err(
                        new UnknownFieldError({
                            fieldId,
                            message: `Unknown working-list field ${fieldId}`,
                        })
                    )
                }
                if (
                    !runtime.activeState.configuration.filters.some(
                        (filter) => filter.fieldId === fieldId
                    )
                )
                    return Result.ok()
                return validateAndCommit(
                    {
                        ...runtime.activeState.configuration,
                        filters:
                            runtime.activeState.configuration.filters.filter(
                                (filter) => filter.fieldId !== fieldId
                            ),
                    },
                    true
                )
            },
            setColumns(fieldIds) {
                const runtime = runtimeRef.current
                if (!runtime.activeState)
                    throw new Error('Working List configuration is unavailable')
                return validateAndCommit(
                    {
                        ...runtime.activeState.configuration,
                        columns: [...fieldIds],
                    },
                    false
                )
            },
            setSort(sort) {
                const runtime = runtimeRef.current
                if (!runtime.activeState)
                    throw new Error('Working List configuration is unavailable')
                return validateAndCommit(
                    { ...runtime.activeState.configuration, sort },
                    true
                )
            },
            setProgramStage(programStageId) {
                const runtime = runtimeRef.current
                if (!runtime.activeState || !runtime.metadata)
                    throw new Error('Working List configuration is unavailable')
                if (
                    programStageId !== undefined &&
                    !runtime.metadata.readableProgramStageIds.has(
                        programStageId
                    )
                ) {
                    return Result.err(
                        new UnknownProgramStageError({
                            programStageId,
                            message: `Unknown program stage ${programStageId}`,
                        })
                    )
                }
                const current = runtime.activeState.configuration
                if (
                    (current.mode === 'event'
                        ? current.programStageId
                        : undefined) === programStageId
                )
                    return Result.ok()
                const filters = current.filters.filter(
                    (filter) =>
                        runtime.metadata?.fields.get(filter.fieldId)?.scope ===
                        'trackedEntity'
                )
                const columns = programStageId
                    ? (runtime.metadata.defaultEventColumnsByStage.get(
                          programStageId
                      ) ?? runtime.metadata.defaultTrackedEntityColumns)
                    : runtime.metadata.defaultTrackedEntityColumns
                const candidate = programStageId
                    ? {
                          mode: 'event' as const,
                          programStageId,
                          filters,
                          columns: [...columns],
                          sort: { ...DEFAULT_WORKING_LIST_SORT },
                      }
                    : {
                          mode: 'trackedEntity' as const,
                          filters,
                          columns: [...columns],
                          sort: { ...DEFAULT_WORKING_LIST_SORT },
                      }
                return validateAndCommit(candidate, true)
            },
            setPage(page) {
                if (!Number.isInteger(page) || page < 1) {
                    return Result.err(
                        new InvalidPaginationError({
                            message: `Page must be a positive integer; received ${String(page)}`,
                        })
                    )
                }
                stagePagination({
                    page,
                    pageSize: runtimeRef.current.effectivePagination.pageSize,
                })
                return Result.ok()
            },
            setPageSize(pageSize) {
                if (!WORKING_LIST_PAGE_SIZES.includes(pageSize)) {
                    return Result.err(
                        new InvalidPaginationError({
                            message: `Unsupported page size ${String(pageSize)}`,
                        })
                    )
                }
                stagePagination({ page: 1, pageSize })
                return Result.ok()
            },
            selectSavedList(id) {
                if (!id.trim())
                    return Result.err(
                        new InvalidConfigurationError({
                            message: 'A saved-list id is required',
                        })
                    )
                hardTransition(id, true)
                return Result.ok()
            },
            clearSavedListSelection() {
                hardTransition(defaultListId, true)
                return Result.ok()
            },
            async createSavedList(name) {
                const runtime = runtimeRef.current
                if (!runtime.online)
                    return Result.err(
                        new OfflineMutationError({
                            message:
                                'Working lists cannot be created while offline',
                        })
                    )
                if (!runtime.resolvedConfiguration || !runtime.metadata)
                    throw new Error('Working List configuration is unavailable')
                const trimmed = name.trim()
                if (!trimmed)
                    return Result.err(
                        new InvalidConfigurationError({
                            message: 'A working-list name is required',
                        })
                    )
                setMutation('create', { status: 'pending' })
                const selectionVersion = selectionToken.current
                try {
                    const snapshot = runtime.resolvedConfiguration
                    const id = await createSavedWorkingList({
                        client,
                        name: trimmed,
                        configuration: snapshot,
                        fields: runtime.metadata.fields,
                        capabilities,
                        serializationContext: runtime.serializationContext,
                    })
                    const lists = await refreshSavedLists()
                    const confirmed = lists.find((list) => list.id === id)
                    if (
                        !confirmed ||
                        confirmed.compatibility !== 'compatible'
                    ) {
                        return Result.err(
                            new WorkingListInvalidResponseError({
                                operation: 'createSavedList',
                                message: `Created saved list ${id} was absent from canonical refresh`,
                            })
                        )
                    }
                    if (selectionToken.current === selectionVersion) {
                        hardTransition(id, true)
                    }
                    return Result.ok({ savedListId: id })
                } catch (cause) {
                    return Result.err(
                        toTransportError(cause, 'Creating a saved working list')
                    )
                } finally {
                    setMutation('create', idleMutation())
                }
            },
            async updateSelectedSavedList() {
                const runtime = runtimeRef.current
                if (!runtime.online)
                    return Result.err(
                        new OfflineMutationError({
                            message:
                                'Working lists cannot be updated while offline',
                        })
                    )
                const id = runtime.activeState?.selectedSavedListId
                if (!id || !runtime.resolvedConfiguration || !runtime.metadata)
                    return Result.err(
                        new NoSelectedSavedListError({
                            message:
                                'No persisted saved working list is selected',
                        })
                    )
                if (
                    id === defaultListId ||
                    runtime.displayedLists.some(
                        (candidate) =>
                            candidate.id === id &&
                            !runtime.confirmedLists?.some(
                                (confirmed) => confirmed.id === id
                            )
                    )
                ) {
                    return Result.err(
                        new NoSelectedSavedListError({
                            message:
                                'The generated working list cannot be updated',
                        })
                    )
                }
                const list = runtime.confirmedLists?.find(
                    (candidate) => candidate.id === id
                )
                if (!list)
                    return Result.err(
                        new SavedListNotFoundError({
                            savedListId: id,
                            message: `Saved working list ${id} was not found`,
                        })
                    )
                if (list.compatibility !== 'compatible')
                    return Result.err(
                        new IncompatibleSavedListError({
                            savedListId: id,
                            message:
                                'Repair this saved working list before updating it',
                        })
                    )
                if (
                    list.sharing.access?.write !== true ||
                    list.sharing.access.update !== true
                )
                    return Result.err(
                        new SavedListPermissionError({
                            savedListId: id,
                            operation: 'update',
                            message: `Update access to ${id} is required`,
                        })
                    )
                const expectedResource =
                    runtime.resolvedConfiguration.mode === 'event'
                        ? 'programStageWorkingLists'
                        : 'trackedEntityInstanceFilters'
                if (list.resource !== expectedResource)
                    return Result.err(
                        new InvalidConfigurationError({
                            message:
                                'Save this mode change as a new working list',
                        })
                    )
                setMutation('update', { status: 'pending', targetId: id })
                try {
                    const snapshot = runtime.resolvedConfiguration
                    await replaceSavedWorkingList({
                        client,
                        id,
                        resource: list.resource,
                        existingResource: list.raw,
                        name: list.name,
                        configuration: snapshot,
                        fields: runtime.metadata.fields,
                        capabilities,
                        sharing: list.sharing,
                        serializationContext: runtime.serializationContext,
                    })
                    const lists = await refreshSavedLists()
                    const confirmed = lists.find(
                        (candidate) => candidate.id === id
                    )
                    if (
                        !confirmed ||
                        confirmed.compatibility !== 'compatible' ||
                        internalConfigurationFingerprint(
                            confirmed.configuration
                        ) !== internalConfigurationFingerprint(snapshot)
                    ) {
                        return Result.err(
                            new WorkingListInvalidResponseError({
                                operation: 'updateSelectedSavedList',
                                message: `Updated saved list ${id} did not match the submitted configuration after canonical refresh`,
                            })
                        )
                    }
                    const publicSnapshot = toPublicConfiguration(snapshot)
                    updateStore((current) => {
                        if (
                            !canCommitMutationBaseline({
                                currentSelectedId:
                                    current.activeState?.selectedSavedListId,
                                currentConfiguration:
                                    current.activeState?.configuration,
                                submittedSelectedId: id,
                                submittedConfiguration: publicSnapshot,
                            })
                        ) {
                            return {}
                        }
                        return {
                            baselineFingerprint:
                                publicConfigurationFingerprint(publicSnapshot),
                            meta: { ...current.meta, dirty: false },
                        }
                    })
                    return Result.ok()
                } catch (cause) {
                    return Result.err(
                        toTransportError(
                            cause,
                            'Updating the saved working list'
                        )
                    )
                } finally {
                    setMutation('update', idleMutation())
                }
            },
            async deleteSavedList(id) {
                const runtime = runtimeRef.current
                if (!runtime.online)
                    return Result.err(
                        new OfflineMutationError({
                            message:
                                'Working lists cannot be deleted while offline',
                        })
                    )
                const list = runtime.confirmedLists?.find(
                    (candidate) => candidate.id === id
                )
                if (!list)
                    return Result.err(
                        new SavedListNotFoundError({
                            savedListId: id,
                            message: `Saved working list ${id} was not found`,
                        })
                    )
                if (list.sharing.access?.delete !== true)
                    return Result.err(
                        new SavedListPermissionError({
                            savedListId: id,
                            operation: 'delete',
                            message: `Delete access to ${id} is required`,
                        })
                    )
                setMutation('delete', { status: 'pending', targetId: id })
                try {
                    await deleteSavedWorkingList(client, list.resource, id)
                    const lists = await refreshSavedLists()
                    if (lists.some((candidate) => candidate.id === id)) {
                        return Result.err(
                            new WorkingListInvalidResponseError({
                                operation: 'deleteSavedList',
                                message: `Deleted saved list ${id} remained after canonical refresh`,
                            })
                        )
                    }
                    if (
                        isCurrentSelection(
                            store.getState().activeState?.selectedSavedListId,
                            id
                        )
                    ) {
                        hardTransition(defaultListId, true)
                    }
                    return Result.ok()
                } catch (cause) {
                    return Result.err(
                        toTransportError(
                            cause,
                            'Deleting the saved working list'
                        )
                    )
                } finally {
                    setMutation('delete', idleMutation())
                }
            },
            downloadVisibleRows(): Result<void, DownloadVisibleRowsError> {
                const runtime = runtimeRef.current
                if (
                    !runtime.activeState ||
                    !runtime.metadata ||
                    !runtime.formattingContext ||
                    !runtime.program ||
                    store.getState().meta.results.status !== 'ready'
                ) {
                    return Result.err(
                        new DownloadVisibleRowsError({
                            message:
                                'Working-list results are not ready to download',
                        })
                    )
                }
                try {
                    downloadRowsAsCsv({
                        rows: runtime.rows,
                        columns: runtime.activeState.configuration.columns,
                        fields: runtime.metadata.fields,
                        formattingContext: runtime.formattingContext,
                        translate,
                        fileName: `${runtime.program.displayName}-working-list.csv`,
                    })
                    return Result.ok()
                } catch (cause) {
                    return Result.err(
                        new DownloadVisibleRowsError({
                            message:
                                'Working-list rows could not be downloaded',
                            cause,
                        })
                    )
                }
            },
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
                await savedListsQuery.refetch()
            },
            async retryResults() {
                await Promise.all([
                    pageQuery.refetch(),
                    organisationUnitLabelsQuery.error
                        ? organisationUnitLabelsQuery.refetch()
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
            organisationUnitLabelsQuery,
            pageQuery,
            refreshSavedLists,
            repairComputation,
            savedListsQuery,
            selectedId,
            selectedList,
            serializationContext,
        ]
    )

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
