import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { Label } from '@dhis2-blocks/ui/label'
import { Switch } from '@dhis2-blocks/ui/switch'
import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
    useWorkingListMeta,
    type WorkingListDataQualityMode,
    type WorkingListResultTarget,
} from '@dhis2-blocks/working-list'
import { trackerProgramsQueryOptions } from '@dhis2-blocks/working-list/development'
import { useQuery } from '@tanstack/react-query'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { getGuardedOrganisationUnitState } from '../contextTransitions'
import { DiscardChangesDialog } from '../DiscardChangesDialog'
import { OrganisationUnitSelectorContent } from '../OrganisationUnitSelectorContent'
import {
    getCaptureOrganisationUnitPickerScope,
    isOrganisationUnitInScope,
    resolveCaptureOrganisationUnitRoots,
    type OrganisationUnitReference,
} from '../organisationUnitScope'
import { isGuardedAppUrlTransition, parseAppUrlState } from '../urlState'
import { useAppUrlState } from '../useAppUrlState'
import i18n from '../../i18n'
import {
    AppRuntimeConfigSchema,
    CurrentUserSchema,
    OrganisationUnitReferenceSchema,
    ProgramOrganisationUnitsSchema,
    retryOperationalError,
} from './contextSchemas'
import { ContextStatus } from './ContextStatus'
import { createAppWorkingListClient } from './createAppWorkingListClient'
import {
    buildProgramOptions,
    hasCaptureProgramDataReadAccess,
} from './programOptions'
import { RecordDetailsModal } from './RecordDetailsModal'
import { WorkingListContextControls } from './WorkingListContextControls'
import { useDebouncedOrganisationUnitSearch } from './useDebouncedOrganisationUnitSearch'
import { useOrganisationUnitSearch } from './useOrganisationUnitSearch'

const WorkingListDirtyBridge = ({
    onChange,
}: {
    onChange(dirty: boolean): void
}) => {
    const dirty = useWorkingListMeta((meta) => meta.dirty)

    useEffect(() => onChange(dirty), [dirty, onChange])
    return null
}

interface PendingTransition {
    proceed: () => void
    cancel?: () => void
}

export const AppShell = () => {
    const engine = useDataEngine()
    const config = useConfig()
    const runtimeConfig = useMemo(
        () => AppRuntimeConfigSchema.parse(config),
        [config]
    )
    const client = useMemo(() => createAppWorkingListClient(engine), [engine])
    const [programSelectorOpen, setProgramSelectorOpen] = useState(false)
    const [orgUnitSelectorOpen, setOrgUnitSelectorOpen] = useState(false)
    const [organisationUnitSearch, setOrganisationUnitSearch] = useState('')
    const [
        debouncedOrganisationUnitSearch,
        setDebouncedOrganisationUnitSearch,
    ] = useDebouncedOrganisationUnitSearch(organisationUnitSearch)
    const [dirty, setDirty] = useState(false)
    const [pendingTransition, setPendingTransition] =
        useState<PendingTransition>()
    const [openedRecord, setOpenedRecord] = useState<WorkingListResultTarget>()
    const [dataQualityMode, setDataQualityMode] =
        useState<WorkingListDataQualityMode>('hidden')
    const requestTransition = useCallback(
        (proceed: () => void) => {
            if (dirty) {
                setPendingTransition({ proceed })
            } else {
                proceed()
            }
        },
        [dirty]
    )
    const [urlState, setUrlState] = useAppUrlState()

    // Guard browser back/forward (and manual hash edits, which the router
    // also receives as POP) against discarding unsaved working-list changes.
    // In-app navigations confirm before writing the URL, so PUSH/REPLACE
    // must pass through unblocked to avoid a double confirmation.
    const externalTransitionBlocker = useBlocker(
        ({ currentLocation, nextLocation, historyAction }) => {
            if (historyAction !== 'POP' || !dirty) {
                return false
            }
            try {
                return isGuardedAppUrlTransition(
                    parseAppUrlState(
                        new URLSearchParams(currentLocation.search)
                    ),
                    parseAppUrlState(new URLSearchParams(nextLocation.search))
                )
            } catch {
                return false
            }
        }
    )
    useEffect(() => {
        if (externalTransitionBlocker.state !== 'blocked') {
            return
        }
        // The latest guarded navigation wins; its reset must always be wired
        // so canceling the dialog restores the popped history entry.
        setPendingTransition({
            proceed: () => {
                setDirty(false)
                setOpenedRecord(undefined)
                externalTransitionBlocker.proceed()
            },
            cancel: externalTransitionBlocker.reset,
        })
    }, [externalTransitionBlocker])

    const programsQuery = useQuery(
        trackerProgramsQueryOptions(client, runtimeConfig.apiVersion)
    )

    const currentUserQuery = useQuery({
        queryKey: ['working-list', 'shell', 'current-user-org-units'],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'me',
                    params: {
                        fields: 'organisationUnits[id,displayName,path],teiSearchOrganisationUnits[id,displayName,path]',
                    },
                },
                CurrentUserSchema,
                signal
            ),
        staleTime: 60 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
        retry: retryOperationalError,
    })

    const programs = useMemo(
        () =>
            (programsQuery.data?.programs ?? []).filter(
                (program) =>
                    program.programType === 'WITH_REGISTRATION' &&
                    hasCaptureProgramDataReadAccess(program)
            ),
        [programsQuery.data]
    )
    const selectedProgramSummary = programs.find(
        (program) => program.id === urlState.programId
    )

    const programOrgUnitsQuery = useQuery({
        queryKey: [
            'working-list',
            'shell',
            'program-org-units',
            urlState.programId,
        ],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'programs',
                    id: urlState.programId,
                    params: {
                        fields: 'organisationUnits[id,displayName,path]',
                    },
                },
                ProgramOrganisationUnitsSchema,
                signal
            ),
        enabled: Boolean(selectedProgramSummary),
        staleTime: 60 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
        retry: retryOperationalError,
    })

    const selectedOrgUnitQuery = useQuery({
        queryKey: [
            'working-list',
            'shell',
            'selected-org-unit',
            urlState.orgUnitId,
        ],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'organisationUnits',
                    id: urlState.orgUnitId,
                    params: { fields: 'id,displayName,path' },
                },
                OrganisationUnitReferenceSchema,
                signal
            ),
        enabled: Boolean(urlState.orgUnitId),
        staleTime: 60 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
        retry: retryOperationalError,
    })

    const organisationUnitSearchQuery = useOrganisationUnitSearch({
        client,
        search: debouncedOrganisationUnitSearch,
        enabled: Boolean(selectedProgramSummary),
    })

    const searchRoots = useMemo(
        () =>
            currentUserQuery.data
                ? resolveCaptureOrganisationUnitRoots(currentUserQuery.data)
                : [],
        [currentUserQuery.data]
    )
    const programOrgUnits = programOrgUnitsQuery.data?.organisationUnits ?? []
    const organisationUnitPickerScope = useMemo(
        () => getCaptureOrganisationUnitPickerScope(searchRoots),
        [searchRoots]
    )
    const selectedOrgUnitIsAllowed = useMemo(
        () =>
            isOrganisationUnitInScope(
                selectedOrgUnitQuery.data,
                searchRoots,
                programOrgUnits
            ),
        [programOrgUnits, searchRoots, selectedOrgUnitQuery.data]
    )
    const compatibleProgramOptions = useMemo(
        () =>
            buildProgramOptions({
                programs,
                selectedOrganisationUnitId: selectedOrgUnitQuery.data?.id,
                selectedOrganisationUnitPath: selectedOrgUnitQuery.data?.path,
                baseUrl: runtimeConfig.baseUrl,
                apiVersion: runtimeConfig.apiVersion,
            }),
        [
            programs,
            runtimeConfig,
            selectedOrgUnitQuery.data?.id,
            selectedOrgUnitQuery.data?.path,
        ]
    )
    const programOptions = useMemo(
        () =>
            buildProgramOptions({
                programs,
                selectedOrganisationUnitId: selectedOrgUnitQuery.data?.id,
                selectedOrganisationUnitPath: selectedOrgUnitQuery.data?.path,
                preservedProgramId: selectedProgramSummary?.id,
                baseUrl: runtimeConfig.baseUrl,
                apiVersion: runtimeConfig.apiVersion,
            }),
        [
            programs,
            runtimeConfig,
            selectedOrgUnitQuery.data?.id,
            selectedOrgUnitQuery.data?.path,
            selectedProgramSummary?.id,
        ]
    )
    const programsAreFiltered =
        compatibleProgramOptions.length < programs.length

    useEffect(() => {
        if (!dirty) {
            return
        }
        const warnBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }
        window.addEventListener('beforeunload', warnBeforeUnload)
        return () =>
            window.removeEventListener('beforeunload', warnBeforeUnload)
    }, [dirty])

    useEffect(() => {
        if (
            !urlState.programId ||
            programsQuery.isPending ||
            programs.some((program) => program.id === urlState.programId)
        ) {
            return
        }
        setUrlState({ orgUnitId: urlState.orgUnitId })
    }, [programs, programsQuery.isPending, setUrlState, urlState])

    const updateProgram = (programId: string) => {
        requestTransition(() => {
            setProgramSelectorOpen(false)
            setOrgUnitSelectorOpen(false)
            setOrganisationUnitSearch('')
            setDebouncedOrganisationUnitSearch('')
            setOpenedRecord(undefined)
            setDirty(false)
            setUrlState(
                programId
                    ? {
                          programId,
                          orgUnitId: urlState.orgUnitId,
                          page: 1,
                          pageSize: 15,
                      }
                    : { orgUnitId: urlState.orgUnitId }
            )
        })
    }

    const updateOrgUnit = (organisationUnit: OrganisationUnitReference) => {
        setOrgUnitSelectorOpen(false)
        setOrganisationUnitSearch('')
        setDebouncedOrganisationUnitSearch('')
        requestTransition(() => {
            const next = getGuardedOrganisationUnitState(
                urlState,
                organisationUnit.id,
                () => true
            )
            setOpenedRecord(undefined)
            setDirty(false)
            setUrlState(next)
        })
    }

    const clearOrganisationUnit = () => {
        requestTransition(() => {
            const next = getGuardedOrganisationUnitState(
                urlState,
                undefined,
                () => true
            )
            setOrgUnitSelectorOpen(false)
            setOrganisationUnitSearch('')
            setDebouncedOrganisationUnitSearch('')
            setOpenedRecord(undefined)
            setDirty(false)
            setUrlState(next)
        })
    }

    const loading =
        programsQuery.isPending ||
        currentUserQuery.isPending ||
        Boolean(selectedProgramSummary && programOrgUnitsQuery.isPending) ||
        Boolean(urlState.orgUnitId && selectedOrgUnitQuery.isPending)
    const shellError =
        programsQuery.error ??
        currentUserQuery.error ??
        (selectedProgramSummary ? programOrgUnitsQuery.error : undefined) ??
        (urlState.orgUnitId ? selectedOrgUnitQuery.error : undefined)

    return (
        <div
            className="min-h-screen w-full min-w-0 max-w-full pb-10"
            data-testid="working-list-app"
        >
            <WorkingListContextControls
                clearDisabled={!selectedProgramSummary && !urlState.orgUnitId}
                onClear={() =>
                    requestTransition(() => {
                        setProgramSelectorOpen(false)
                        setOrgUnitSelectorOpen(false)
                        setOrganisationUnitSearch('')
                        setDebouncedOrganisationUnitSearch('')
                        setDirty(false)
                        setOpenedRecord(undefined)
                        setUrlState({})
                    })
                }
                programOptions={programOptions}
                programValue={selectedProgramSummary?.id}
                programOpen={programSelectorOpen}
                onProgramOpenChange={setProgramSelectorOpen}
                onProgramChange={updateProgram}
                onProgramClear={() => updateProgram('')}
                programLoading={programsQuery.isPending}
                programLoadingLabel={i18n.t('Loading tracker programs…')}
                programsAreFiltered={programsAreFiltered}
                onShowAllPrograms={clearOrganisationUnit}
                showOrganisationUnit={Boolean(selectedProgramSummary)}
                organisationUnitValue={selectedOrgUnitQuery.data?.displayName}
                organisationUnitOpen={orgUnitSelectorOpen}
                onOrganisationUnitOpenChange={(open) => {
                    setOrgUnitSelectorOpen(open)
                    if (!open) {
                        setOrganisationUnitSearch('')
                        setDebouncedOrganisationUnitSearch('')
                    }
                }}
                onOrganisationUnitClear={clearOrganisationUnit}
                organisationUnitLoading={currentUserQuery.isPending}
                organisationUnitDisabled={
                    organisationUnitPickerScope.pickerRoots.length === 0
                }
                organisationUnitContent={
                    <OrganisationUnitSelectorContent
                        roots={organisationUnitPickerScope.pickerRoots}
                        allowedPaths={organisationUnitPickerScope.allowedPaths}
                        selected={selectedOrgUnitQuery.data}
                        searchValue={organisationUnitSearch}
                        treeKey={debouncedOrganisationUnitSearch || 'initial'}
                        onSearchChange={setOrganisationUnitSearch}
                        searchRoots={
                            debouncedOrganisationUnitSearch
                                ? (organisationUnitSearchQuery.data?.pages.flatMap(
                                      (page) => page.organisationUnits
                                  ) ?? [])
                                : undefined
                        }
                        searchLoading={
                            Boolean(debouncedOrganisationUnitSearch) &&
                            organisationUnitSearchQuery.isFetching &&
                            !organisationUnitSearchQuery.data
                        }
                        searchError={
                            Boolean(debouncedOrganisationUnitSearch) &&
                            organisationUnitSearchQuery.isError &&
                            !organisationUnitSearchQuery.data
                        }
                        onSearchRetry={() =>
                            void organisationUnitSearchQuery.refetch()
                        }
                        searchHasMore={organisationUnitSearchQuery.hasNextPage}
                        searchLoadingMore={
                            organisationUnitSearchQuery.isFetchingNextPage
                        }
                        searchLoadMoreError={
                            organisationUnitSearchQuery.isFetchNextPageError
                        }
                        onSearchLoadMore={() =>
                            void organisationUnitSearchQuery.fetchNextPage()
                        }
                        onSelect={updateOrgUnit}
                    />
                }
            />
            <h1
                className="absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!"
                data-testid="working-list-heading"
            >
                {i18n.t('Working lists')}
            </h1>

            <ContextStatus
                loading={loading}
                error={shellError}
                hasProgram={Boolean(selectedProgramSummary)}
                organisationUnitId={urlState.orgUnitId}
                organisationUnitIsAllowed={selectedOrgUnitIsAllowed}
                canChooseOrganisationUnit={
                    organisationUnitPickerScope.pickerRoots.length > 0
                }
                onChooseOrganisationUnit={() => setOrgUnitSelectorOpen(true)}
                onRetry={() => {
                    void programsQuery.refetch()
                    void currentUserQuery.refetch()
                    if (selectedProgramSummary) {
                        void programOrgUnitsQuery.refetch()
                    }
                    if (urlState.orgUnitId) {
                        void selectedOrgUnitQuery.refetch()
                    }
                }}
            />

            {!loading &&
                !shellError &&
                selectedProgramSummary &&
                urlState.orgUnitId &&
                selectedOrgUnitIsAllowed && (
                    <main
                        className="mx-auto mt-4 w-full min-w-0 max-w-[1440px] px-6 [@media(max-width:900px)]:px-3"
                        data-testid="working-list-layout"
                    >
                        <div className="flex justify-end pb-3">
                            <Label data-test="data-quality-mode-toggle">
                                <Switch
                                    checked={dataQualityMode === 'highlighted'}
                                    onCheckedChange={(checked) =>
                                        setDataQualityMode(
                                            checked ? 'highlighted' : 'hidden'
                                        )
                                    }
                                />
                                {i18n.t('Highlight data quality issues')}
                            </Label>
                        </div>
                        <WorkingList
                            programId={selectedProgramSummary.id}
                            orgUnitId={urlState.orgUnitId}
                            viewId={urlState.selectedTemplateId ?? null}
                            pagination={{
                                page: urlState.page ?? 1,
                                pageSize: urlState.pageSize ?? 15,
                            }}
                            onPaginationChange={({ page, pageSize }) =>
                                setUrlState((current) => ({
                                    ...current,
                                    page,
                                    pageSize,
                                }))
                            }
                            onViewChange={(viewId) =>
                                setUrlState((current) => ({
                                    ...current,
                                    selectedTemplateId: viewId,
                                    page: 1,
                                }))
                            }
                        >
                            <WorkingListDirtyBridge onChange={setDirty} />
                            <WorkingListViewSwitcher />
                            <WorkingListToolbar>
                                <WorkingListColumnSelector />
                                <WorkingListFilterControls />
                                <WorkingListToolbarActions />
                            </WorkingListToolbar>
                            <WorkingListTable
                                dataQualityMode={dataQualityMode}
                                onRowClick={setOpenedRecord}
                            />
                        </WorkingList>
                    </main>
                )}

            <DiscardChangesDialog
                open={Boolean(pendingTransition)}
                onCancel={() => {
                    const transition = pendingTransition
                    setPendingTransition(undefined)
                    transition?.cancel?.()
                }}
                onDiscard={() => {
                    const transition = pendingTransition
                    setPendingTransition(undefined)
                    setDirty(false)
                    transition?.proceed()
                }}
            />

            {openedRecord && (
                <RecordDetailsModal
                    record={openedRecord}
                    onClose={() => setOpenedRecord(undefined)}
                />
            )}

            <footer className="mx-auto mt-8 flex w-full max-w-[1440px] justify-end gap-4 px-6 [@media(max-width:900px)]:px-3">
                <a
                    className="text-xs text-[#6c7787] underline-offset-2 hover:text-[#147cd7] hover:underline"
                    href="#/context-selector-showcase"
                >
                    Context Selector showcase
                </a>
                <a
                    className="text-xs text-[#6c7787] underline-offset-2 hover:text-[#147cd7] hover:underline"
                    href="#/event-form"
                >
                    Event Form demo
                </a>
            </footer>
        </div>
    )
}
