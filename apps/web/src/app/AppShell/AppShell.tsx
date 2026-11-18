import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import React, { useEffect, useMemo, useState } from 'react'
import {
    getOrganisationUnitState,
    getProgramState,
} from '../contextTransitions'
import { OrganisationUnitSelectorContent } from '../OrganisationUnitSelectorContent'
import {
    getCaptureOrganisationUnitPickerScope,
    isOrganisationUnitInScope,
    resolveCaptureOrganisationUnitRoots,
    type OrganisationUnitReference,
} from '../organisationUnitScope'
import { PatientListView } from '../PatientListView'
import { parseAppPageSize } from '../urlState'
import { useAppUrlState } from '../useAppUrlState'
import i18n from '../../i18n'
import {
    AppRuntimeConfigSchema,
    CurrentUserSchema,
    OrganisationUnitReferenceSchema,
    ProgramOrganisationUnitsSchema,
    retryOperationalError,
} from './contextSchemas'
import { AppContextControls } from './AppContextControls'
import { createAppClient } from './appClient'
import { ContextStatus } from './ContextStatus'
import {
    buildProgramOptions,
    hasCaptureProgramDataReadAccess,
} from './programOptions'
import { trackerProgramsQueryOptions } from './programsQuery'
import { RecordDetailsModal } from './RecordDetailsModal'
import { useDebouncedOrganisationUnitSearch } from './useDebouncedOrganisationUnitSearch'
import { useOrganisationUnitSearch } from './useOrganisationUnitSearch'

export const AppShell = () => {
    const engine = useDataEngine()
    const config = useConfig()
    const runtimeConfig = useMemo(
        () => AppRuntimeConfigSchema.parse(config),
        [config]
    )
    const client = useMemo(() => createAppClient(engine), [engine])
    const [programSelectorOpen, setProgramSelectorOpen] = useState(false)
    const [orgUnitSelectorOpen, setOrgUnitSelectorOpen] = useState(false)
    const [organisationUnitSearch, setOrganisationUnitSearch] = useState('')
    const [
        debouncedOrganisationUnitSearch,
        setDebouncedOrganisationUnitSearch,
    ] = useDebouncedOrganisationUnitSearch(organisationUnitSearch)
    const [openedTrackedEntityId, setOpenedTrackedEntityId] = useState<
        string | undefined
    >()
    const [urlState, setUrlState] = useAppUrlState()

    const programsQuery = useQuery(
        trackerProgramsQueryOptions(client, runtimeConfig.apiVersion)
    )

    const currentUserQuery = useQuery({
        queryKey: ['app-shell', 'current-user-org-units'],
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
        queryKey: ['app-shell', 'program-org-units', urlState.programId],
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
        queryKey: ['app-shell', 'selected-org-unit', urlState.orgUnitId],
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
        if (
            !urlState.programId ||
            programsQuery.isPending ||
            programs.some((program) => program.id === urlState.programId)
        ) {
            return
        }
        setUrlState(getProgramState(urlState, undefined))
    }, [programs, programsQuery.isPending, setUrlState, urlState])

    const updateProgram = (programId: string) => {
        setProgramSelectorOpen(false)
        setOrgUnitSelectorOpen(false)
        setOrganisationUnitSearch('')
        setDebouncedOrganisationUnitSearch('')
        setOpenedTrackedEntityId(undefined)
        setUrlState(getProgramState(urlState, programId))
    }

    const updateOrgUnit = (organisationUnit: OrganisationUnitReference) => {
        setOrgUnitSelectorOpen(false)
        setOrganisationUnitSearch('')
        setDebouncedOrganisationUnitSearch('')
        setOpenedTrackedEntityId(undefined)
        setUrlState(getOrganisationUnitState(urlState, organisationUnit.id))
    }

    const clearOrganisationUnit = () => {
        setOrgUnitSelectorOpen(false)
        setOrganisationUnitSearch('')
        setDebouncedOrganisationUnitSearch('')
        setOpenedTrackedEntityId(undefined)
        setUrlState(getOrganisationUnitState(urlState, undefined))
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
        <div className="min-h-screen w-full min-w-0 max-w-full pb-10">
            <AppContextControls
                clearDisabled={!selectedProgramSummary && !urlState.orgUnitId}
                onClear={() => {
                    setProgramSelectorOpen(false)
                    setOrgUnitSelectorOpen(false)
                    setOrganisationUnitSearch('')
                    setDebouncedOrganisationUnitSearch('')
                    setOpenedTrackedEntityId(undefined)
                    setUrlState({})
                }}
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
                data-testid="patient-list-heading"
            >
                {i18n.t('Patient list')}
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
                        data-testid="patient-list-layout"
                    >
                        <PatientListView
                            client={client}
                            programId={selectedProgramSummary.id}
                            orgUnitId={urlState.orgUnitId}
                            page={urlState.page ?? 1}
                            pageSize={urlState.pageSize ?? 15}
                            onPaginationChange={({ page, pageSize }) =>
                                setUrlState((current) => ({
                                    ...current,
                                    page,
                                    pageSize: parseAppPageSize(pageSize),
                                }))
                            }
                            onRowOpen={setOpenedTrackedEntityId}
                        />
                    </main>
                )}

            {openedTrackedEntityId && (
                <RecordDetailsModal
                    trackedEntityId={openedTrackedEntityId}
                    onClose={() => setOpenedTrackedEntityId(undefined)}
                />
            )}

            <footer className="mx-auto mt-8 flex w-full max-w-[1440px] justify-end px-6 [@media(max-width:900px)]:px-3">
                <a
                    className="text-xs text-dhis2-subtle-foreground underline-offset-2 hover:text-dhis2-primary hover:underline"
                    href="#/context-selector-showcase"
                >
                    Context Selector showcase
                </a>
            </footer>
        </div>
    )
}
