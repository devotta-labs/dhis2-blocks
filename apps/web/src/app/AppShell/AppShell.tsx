import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { Button, CircularLoader, NoticeBox, Switch } from '@dhis2/ui'
import {
    WorkingList,
    useWorkingListMeta,
    type WorkingListDataQualityMode,
    type WorkingListResultTarget,
} from '@dhis2-blocks/working-list'
import { trackerProgramsQueryOptions } from '@dhis2-blocks/working-list/development'
import { useQuery } from '@tanstack/react-query'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { z, ZodError } from 'zod'
import { ContextSelectorBar } from '../ContextSelectorBar'
import { getGuardedOrganisationUnitState } from '../contextTransitions'
import {
    OrganisationUnitPicker,
    type OrganisationUnitReference,
} from '../OrganisationUnitPicker'
import {
    intersectOrganisationUnitScopes,
    isOrganisationUnitInScope,
    resolveTrackerSearchRoots,
} from '../organisationUnitScope'
import { isGuardedAppUrlTransition, parseAppUrlState } from '../urlState'
import { useAppUrlState } from '../useAppUrlState'
import i18n from '../../i18n'
import { createAppWorkingListClient } from './createAppWorkingListClient'
import { RecordDetailsModal } from './RecordDetailsModal'

const contextStateClassName =
    'mx-auto mt-4 flex min-h-[220px] w-full min-w-0 max-w-[1440px] flex-col items-center justify-center gap-3 px-6 text-center text-[#405261] [@media(max-width:900px)]:px-3 [&_h2]:text-[20px] [&_h2]:font-medium [&_h2]:text-[#17212b] [&_p]:m-0 [&_p]:max-w-[560px]'

const OrganisationUnitReferenceSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        path: z.string().min(1),
    })
    .passthrough()

const CurrentUserSchema = z
    .object({
        organisationUnits: z.array(OrganisationUnitReferenceSchema),
        teiSearchOrganisationUnits: z
            .array(OrganisationUnitReferenceSchema)
            .optional(),
    })
    .passthrough()

const ProgramOrganisationUnitsSchema = z
    .object({
        organisationUnits: z.array(OrganisationUnitReferenceSchema),
    })
    .passthrough()

const AppRuntimeConfigSchema = z
    .object({ apiVersion: z.coerce.number().int().positive() })
    .passthrough()

const retryOperationalError = (failureCount: number, error: Error) =>
    !(error instanceof ZodError) && failureCount < 2

const WorkingListDirtyBridge = ({
    onChange,
}: {
    onChange(dirty: boolean): void
}) => {
    const dirty = useWorkingListMeta((meta) => meta.dirty)

    useEffect(() => onChange(dirty), [dirty, onChange])
    return null
}

export const AppShell = () => {
    const engine = useDataEngine()
    const config = useConfig()
    const runtimeConfig = useMemo(
        () => AppRuntimeConfigSchema.parse(config),
        [config]
    )
    const client = useMemo(() => createAppWorkingListClient(engine), [engine])
    const [orgUnitPickerOpen, setOrgUnitPickerOpen] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [openedRecord, setOpenedRecord] = useState<WorkingListResultTarget>()
    const [dataQualityMode, setDataQualityMode] =
        useState<WorkingListDataQualityMode>('hidden')
    const confirmDiscard = useCallback(() => {
        if (!dirty) {
            return true
        }
        return window.confirm(
            i18n.t('Discard the unsaved changes to this working list?')
        )
    }, [dirty])
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
        if (confirmDiscard()) {
            setDirty(false)
            setOpenedRecord(undefined)
            externalTransitionBlocker.proceed()
        } else {
            externalTransitionBlocker.reset()
        }
    }, [confirmDiscard, externalTransitionBlocker])

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
                    program.access?.read !== false
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
        enabled: Boolean(selectedProgramSummary && urlState.orgUnitId),
        staleTime: 60 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
        retry: retryOperationalError,
    })

    const searchRoots = useMemo(
        () =>
            currentUserQuery.data
                ? resolveTrackerSearchRoots(currentUserQuery.data)
                : [],
        [currentUserQuery.data]
    )
    const programOrgUnits = programOrgUnitsQuery.data?.organisationUnits ?? []
    const organisationUnitScope = useMemo(
        () => intersectOrganisationUnitScopes(searchRoots, programOrgUnits),
        [programOrgUnits, searchRoots]
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
        setUrlState({})
    }, [programs, programsQuery.isPending, setUrlState, urlState.programId])

    const updateProgram = (programId: string) => {
        if (!confirmDiscard()) {
            return
        }
        setOpenedRecord(undefined)
        setDirty(false)
        setUrlState(programId ? { programId, page: 1, pageSize: 15 } : {})
    }

    const updateOrgUnit = (organisationUnit: OrganisationUnitReference) => {
        const next = getGuardedOrganisationUnitState(
            urlState,
            organisationUnit.id,
            confirmDiscard
        )
        if (next === urlState) {
            return
        }
        setOpenedRecord(undefined)
        setDirty(false)
        setUrlState(next)
    }

    const loading =
        programsQuery.isPending ||
        currentUserQuery.isPending ||
        Boolean(
            selectedProgramSummary &&
            (programOrgUnitsQuery.isPending ||
                (urlState.orgUnitId && selectedOrgUnitQuery.isPending))
        )
    const shellError =
        programsQuery.error ??
        currentUserQuery.error ??
        (selectedProgramSummary ? programOrgUnitsQuery.error : undefined) ??
        (selectedProgramSummary && urlState.orgUnitId
            ? selectedOrgUnitQuery.error
            : undefined)

    return (
        <div
            className="min-h-screen w-full min-w-0 max-w-full pb-10"
            data-testid="working-list-app"
        >
            <ContextSelectorBar
                programs={programs}
                selectedProgram={selectedProgramSummary}
                selectedOrgUnitName={selectedOrgUnitQuery.data?.displayName}
                programsLoading={programsQuery.isPending}
                orgUnitDisabled={
                    !selectedProgramSummary || currentUserQuery.isPending
                }
                onClearAll={() => {
                    if (confirmDiscard()) {
                        setDirty(false)
                        setOpenedRecord(undefined)
                        setUrlState({})
                    }
                }}
                onClearOrgUnit={() => {
                    const next = getGuardedOrganisationUnitState(
                        urlState,
                        undefined,
                        confirmDiscard
                    )
                    if (next === urlState) {
                        return
                    }
                    setOpenedRecord(undefined)
                    setDirty(false)
                    setUrlState(next)
                }}
                onOpenOrgUnit={() => setOrgUnitPickerOpen(true)}
                onProgramChange={updateProgram}
            />

            <OrganisationUnitPicker
                open={orgUnitPickerOpen}
                roots={organisationUnitScope.pickerRoots}
                allowedPaths={organisationUnitScope.allowedPaths}
                selected={selectedOrgUnitQuery.data}
                onChange={updateOrgUnit}
                onClose={() => setOrgUnitPickerOpen(false)}
            />

            {loading && (
                <main
                    className={contextStateClassName}
                    data-testid="app-context-loading"
                    aria-live="polite"
                >
                    <CircularLoader small />
                    <p>{i18n.t('Loading tracker programs…')}</p>
                </main>
            )}

            {!loading && shellError && (
                <main
                    className={contextStateClassName}
                    data-testid="app-context-error"
                >
                    <NoticeBox
                        error
                        title={i18n.t('Could not load app context')}
                    >
                        <p>
                            {shellError instanceof Error
                                ? shellError.message
                                : String(shellError)}
                        </p>
                        <Button
                            onClick={() => {
                                void programsQuery.refetch()
                                void currentUserQuery.refetch()
                                if (selectedProgramSummary) {
                                    void programOrgUnitsQuery.refetch()
                                }
                                if (
                                    selectedProgramSummary &&
                                    urlState.orgUnitId
                                ) {
                                    void selectedOrgUnitQuery.refetch()
                                }
                            }}
                        >
                            {i18n.t('Try again')}
                        </Button>
                    </NoticeBox>
                </main>
            )}

            {!loading && !shellError && !selectedProgramSummary && (
                <main
                    className={contextStateClassName}
                    data-testid="program-empty-state"
                >
                    <h2>{i18n.t('Choose a program to start')}</h2>
                    <p>
                        {i18n.t(
                            'Working lists query tracked entities and program-stage events for the selected tracker program.'
                        )}
                    </p>
                </main>
            )}

            {!loading &&
                !shellError &&
                selectedProgramSummary &&
                !urlState.orgUnitId && (
                    <main
                        className={contextStateClassName}
                        data-testid="org-unit-empty-state"
                    >
                        <h2>{i18n.t('Choose an organisation unit')}</h2>
                        <p>
                            {i18n.t(
                                'Select an organisation unit assigned to both you and this program.'
                            )}
                        </p>
                        <Button
                            primary
                            dataTest="choose-org-unit"
                            onClick={() => setOrgUnitPickerOpen(true)}
                        >
                            {i18n.t('Choose organisation unit')}
                        </Button>
                    </main>
                )}

            {!loading &&
                !shellError &&
                selectedProgramSummary &&
                urlState.orgUnitId &&
                !selectedOrgUnitIsAllowed && (
                    <main
                        className={contextStateClassName}
                        data-testid="invalid-org-unit-context"
                    >
                        <NoticeBox
                            error
                            title={i18n.t(
                                'Organisation unit is outside the available scope'
                            )}
                        >
                            <p>
                                {i18n.t(
                                    'Choose an organisation unit assigned to both you and this program.'
                                )}
                            </p>
                            <Button
                                dataTest="replace-invalid-org-unit"
                                onClick={() => setOrgUnitPickerOpen(true)}
                            >
                                {i18n.t('Choose another organisation unit')}
                            </Button>
                        </NoticeBox>
                    </main>
                )}

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
                            <Switch
                                dataTest="data-quality-mode-toggle"
                                checked={dataQualityMode === 'highlighted'}
                                label={i18n.t('Highlight data quality issues')}
                                onChange={({ checked }) =>
                                    setDataQualityMode(
                                        checked ? 'highlighted' : 'hidden'
                                    )
                                }
                            />
                        </div>
                        <WorkingList.Provider
                            programId={selectedProgramSummary.id}
                            orgUnitId={urlState.orgUnitId}
                            selectedSavedListId={urlState.selectedTemplateId}
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
                            onSelectedSavedListChange={(selectedSavedListId) =>
                                setUrlState((current) => ({
                                    ...current,
                                    selectedTemplateId: selectedSavedListId,
                                    page: 1,
                                }))
                            }
                        >
                            <WorkingListDirtyBridge onChange={setDirty} />
                            <WorkingList.Container>
                                <WorkingList.Section
                                    title={i18n.t(
                                        'Saved views in this program'
                                    )}
                                >
                                    <WorkingList.SavedViews />
                                </WorkingList.Section>
                                <WorkingList.Section
                                    ariaLabel={i18n.t('Tracked entity filters')}
                                >
                                    <WorkingList.Toolbar>
                                        <WorkingList.Columns />
                                        <WorkingList.Filters />
                                        <WorkingList.Actions />
                                    </WorkingList.Toolbar>
                                </WorkingList.Section>
                                <WorkingList.Section
                                    ariaLabel={i18n.t('Working list results')}
                                >
                                    <WorkingList.Results
                                        dataQualityMode={dataQualityMode}
                                        onClick={setOpenedRecord}
                                    />
                                </WorkingList.Section>
                            </WorkingList.Container>
                        </WorkingList.Provider>
                    </main>
                )}

            {openedRecord && (
                <RecordDetailsModal
                    record={openedRecord}
                    onClose={() => setOpenedRecord(undefined)}
                />
            )}
        </div>
    )
}
