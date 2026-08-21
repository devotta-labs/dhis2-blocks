import { useConfig, useDataEngine, useOnlineStatus } from '@dhis2/app-runtime'
import {
    Button,
    CircularLoader,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
    NoticeBox,
    Switch,
} from '@dhis2/ui'
import {
    createWorkingListClient,
    trackerProgramQueryOptions,
    trackerProgramsQueryOptions,
    workingListSystemInfoQueryOptions,
    WorkingList,
    type DataEngineLike,
    type DataEngineMutation,
    type DataEngineQuery,
    type WorkingListDataQualityMode,
    type WorkingListRowOpenEvent,
} from '@dhis2-blocks/working-list'
import { useQuery } from '@tanstack/react-query'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
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
import {
    isGuardedAppUrlTransition,
    parseAppUrlState,
    parseAppUrlStateFromHash,
    serializeAppUrlState,
    type AppUrlState,
} from '../urlState'
import i18n from '@/locales'

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

type WorkingListEngineValue = Awaited<
    ReturnType<DataEngineLike['query']>
>[string]

const DataEngineValueSchema: z.ZodType<WorkingListEngineValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.undefined(),
        z.array(DataEngineValueSchema),
        z.record(z.string(), DataEngineValueSchema),
    ])
)
const DataEngineResultSchema = z.record(z.string(), DataEngineValueSchema)
const MutationDataSchema = z.record(z.string(), z.json())
const RuntimeQueryParameterSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.undefined(),
    z.array(z.union([z.string(), z.number()])),
])

const toRuntimeQuery = (query: DataEngineQuery) =>
    Object.fromEntries(
        Object.entries(query).map(([key, definition]) => {
            const params = definition.params
                ? Object.fromEntries(
                      Object.entries(definition.params).map(
                          ([parameter, value]) => [
                              parameter,
                              RuntimeQueryParameterSchema.parse(value),
                          ]
                      )
                  )
                : undefined
            return [
                key,
                {
                    resource: definition.resource,
                    id: definition.id,
                    params,
                },
            ]
        })
    )

const toRuntimeMutation = (mutation: DataEngineMutation) => {
    if (mutation.type === 'delete') {
        if (!mutation.id) {
            throw new Error('A delete mutation requires an id')
        }
        return {
            resource: mutation.resource,
            id: mutation.id,
            type: mutation.type,
        } as const
    }
    const data = MutationDataSchema.parse(mutation.data)
    if (mutation.type === 'create') {
        return {
            resource: mutation.resource,
            type: mutation.type,
            data,
        } as const
    }
    if (!mutation.id) {
        throw new Error(`${mutation.type} mutation requires an id`)
    }
    return {
        resource: mutation.resource,
        id: mutation.id,
        type: mutation.type,
        data,
    } as const
}

const useAppUrlState = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const state = useMemo(() => parseAppUrlState(searchParams), [searchParams])
    const update = useCallback(
        (next: AppUrlState | ((current: AppUrlState) => AppUrlState)) => {
            const resolveNext =
                next instanceof Function
                    ? (current: AppUrlState) => next(current)
                    : () => next
            setSearchParams((committed) =>
                serializeAppUrlState(
                    resolveNext(
                        globalThis.window
                            ? parseAppUrlStateFromHash(window.location.hash)
                            : parseAppUrlState(committed)
                    )
                )
            )
        },
        [setSearchParams]
    )
    return [state, update] as const
}

export const AppShell = () => {
    const engine = useDataEngine()
    const config = useConfig()
    const runtimeConfig = useMemo(
        () => AppRuntimeConfigSchema.parse(config),
        [config]
    )
    const networkStatus = useOnlineStatus()
    const client = useMemo(() => {
        const dataEngine: DataEngineLike = {
            query: async (query, options) =>
                DataEngineResultSchema.parse(
                    await engine.query(toRuntimeQuery(query), options)
                ),
            mutate: (mutation) => engine.mutate(toRuntimeMutation(mutation)),
        }
        return createWorkingListClient(dataEngine)
    }, [engine])
    const [orgUnitPickerOpen, setOrgUnitPickerOpen] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [openedRecord, setOpenedRecord] = useState<WorkingListRowOpenEvent>()
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
    const systemInfoQuery = useQuery(workingListSystemInfoQueryOptions(client))

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
    const selectedProgramQuery = useQuery({
        ...trackerProgramQueryOptions(
            client,
            urlState.programId ?? 'no-program-selected',
            runtimeConfig.apiVersion
        ),
        enabled: Boolean(selectedProgramSummary),
    })
    const selectedProgram = selectedProgramQuery.data

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
        systemInfoQuery.isPending ||
        currentUserQuery.isPending ||
        Boolean(
            selectedProgramSummary &&
            (selectedProgramQuery.isPending ||
                programOrgUnitsQuery.isPending ||
                (urlState.orgUnitId && selectedOrgUnitQuery.isPending))
        )
    const shellError =
        programsQuery.error ??
        systemInfoQuery.error ??
        currentUserQuery.error ??
        (selectedProgramSummary ? selectedProgramQuery.error : undefined) ??
        (selectedProgramSummary ? programOrgUnitsQuery.error : undefined) ??
        (selectedProgramSummary && urlState.orgUnitId
            ? selectedOrgUnitQuery.error
            : undefined)

    return (
        <div className="app-shell" data-testid="working-list-app">
            {!networkStatus.online && (
                <div
                    className="offline-notice"
                    data-testid="offline-notice"
                    role="status"
                >
                    {i18n.t(
                        'You are offline. Cached results remain available; server actions are disabled.'
                    )}
                </div>
            )}

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
                    className="context-state"
                    data-testid="app-context-loading"
                    aria-live="polite"
                >
                    <CircularLoader small />
                    <p>{i18n.t('Loading tracker programs…')}</p>
                </main>
            )}

            {!loading && shellError && (
                <main className="context-state" data-testid="app-context-error">
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
                                void systemInfoQuery.refetch()
                                void currentUserQuery.refetch()
                                if (selectedProgramSummary) {
                                    void selectedProgramQuery.refetch()
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
                    className="context-state"
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
                selectedProgram &&
                !urlState.orgUnitId && (
                    <main
                        className="context-state"
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
                selectedProgram &&
                urlState.orgUnitId &&
                !selectedOrgUnitIsAllowed && (
                    <main
                        className="context-state"
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
                selectedProgram &&
                urlState.orgUnitId &&
                selectedOrgUnitIsAllowed && (
                    <main
                        className="working-list-layout"
                        data-testid="working-list-main"
                    >
                        <div className="working-list-demo-toolbar">
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
                        <WorkingList
                            key={selectedProgram.id}
                            dataQualityMode={dataQualityMode}
                            apiVersion={runtimeConfig.apiVersion}
                            client={client}
                            online={networkStatus.online}
                            orgUnitId={urlState.orgUnitId}
                            page={urlState.page ?? 1}
                            pageSize={urlState.pageSize ?? 15}
                            program={selectedProgram}
                            systemInfo={systemInfoQuery.data!}
                            locale={i18n.language}
                            selectedTemplateId={urlState.selectedTemplateId}
                            onDirtyChange={setDirty}
                            onPageChange={(page, pageSize) =>
                                setUrlState((current) => ({
                                    ...current,
                                    page,
                                    pageSize,
                                }))
                            }
                            onRowOpen={setOpenedRecord}
                            onSelectedTemplateChange={(selectedTemplateId) =>
                                setUrlState((current) => ({
                                    ...current,
                                    selectedTemplateId,
                                    page: 1,
                                }))
                            }
                            requestDiscardConfirmation={confirmDiscard}
                        />
                    </main>
                )}

            {openedRecord && (
                <Modal
                    small
                    position="middle"
                    onClose={() => setOpenedRecord(undefined)}
                >
                    <ModalTitle>
                        {openedRecord.mode === 'event'
                            ? i18n.t('Event selected')
                            : i18n.t('Tracked entity selected')}
                    </ModalTitle>
                    <ModalContent>
                        <dl className="record-details">
                            {openedRecord.mode === 'event' && (
                                <>
                                    <dt>{i18n.t('Event ID')}</dt>
                                    <dd>{openedRecord.eventId}</dd>
                                </>
                            )}
                            <dt>{i18n.t('Tracked entity ID')}</dt>
                            <dd>
                                {openedRecord.mode === 'trackedEntity'
                                    ? openedRecord.trackedEntityId
                                    : (openedRecord.trackedEntityId ?? '—')}
                            </dd>
                        </dl>
                    </ModalContent>
                    <ModalActions>
                        <Button
                            primary
                            onClick={() => setOpenedRecord(undefined)}
                        >
                            {i18n.t('Close')}
                        </Button>
                    </ModalActions>
                </Modal>
            )}
        </div>
    )
}
