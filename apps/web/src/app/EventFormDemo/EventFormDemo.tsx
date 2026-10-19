import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import {
    ClearSelections,
    ContextSelector,
    EnrollmentSelector,
    ProgramSelector,
    StageSelector,
    type Option,
} from '@dhis2-blocks/context-selector'
import type { EventFormSavedResult } from '@dhis2-blocks/event-form'
import { Alert, AlertAction } from '@dhis2-blocks/ui/alert'
import { Button } from '@dhis2-blocks/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@dhis2-blocks/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuTriggerArrow,
} from '@dhis2-blocks/ui/dropdown-menu'
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
    type WorkingListResultTarget,
} from '@dhis2-blocks/working-list'
import { trackerProgramsQueryOptions } from '@dhis2-blocks/working-list/development'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppRuntimeConfigSchema } from '../AppShell/contextSchemas'
import { createAppWorkingListClient } from '../AppShell/createAppWorkingListClient'
import {
    buildProgramOptions,
    hasCaptureProgramDataReadAccess,
} from '../AppShell/programOptions'
import i18n from '../../i18n'
import { DemoEventForm } from './DemoEventForm'
import { DemoOrganisationUnitSelector } from './DemoOrganisationUnitSelector'
import {
    parseEventFormDemoUrlState,
    serializeEventFormDemoUrlState,
    withEnrollment,
    withForm,
    withOrgUnit,
    withProgram,
    withStage,
    withoutForm,
    type EventFormDemoUrlState,
} from './demoUrlState'
import { ListStageBridge } from './ListStageBridge'
import {
    useEnrollment,
    useEnrollments,
    useOrganisationUnitReference,
    useProgramStages,
    type DemoEnrollment,
} from './useEventFormDemoData'

type OpenSelector = 'program' | 'organisationUnit' | 'enrollment' | 'stage'

const enrollmentOption = (enrollment: DemoEnrollment): Option => ({
    value: enrollment.enrollment,
    label: `${enrollment.enrolledAt?.slice(0, 10) ?? i18n.t('Enrollment')} · ${enrollment.enrollment}`,
})

const formSurfaceClassName =
    'rounded-dhis2-sm bg-white p-6 shadow-dhis2-card [@media(max-width:900px)]:p-3'

export const EventFormDemo = () => {
    const engine = useDataEngine()
    const config = useConfig()
    const runtimeConfig = useMemo(
        () => AppRuntimeConfigSchema.parse(config),
        [config]
    )
    const client = useMemo(() => createAppWorkingListClient(engine), [engine])
    const queryClient = useQueryClient()
    const [searchParams, setSearchParams] = useSearchParams()
    const urlState = useMemo(
        () => parseEventFormDemoUrlState(searchParams),
        [searchParams]
    )
    const navigate = (next: EventFormDemoUrlState) =>
        setSearchParams(serializeEventFormDemoUrlState(next))

    const [openSelector, setOpenSelector] = useState<OpenSelector>()
    const [focusMode, setFocusMode] = useState(false)
    const [notice, setNotice] = useState<EventFormSavedResult['outcome']>()

    const programsQuery = useQuery(
        trackerProgramsQueryOptions(client, runtimeConfig.apiVersion)
    )
    const orgUnitQuery = useOrganisationUnitReference(
        client,
        urlState.orgUnitId
    )
    const stagesQuery = useProgramStages(client, urlState.programId)
    const enrollmentsQuery = useEnrollments(
        client,
        runtimeConfig.apiVersion,
        urlState.programId,
        urlState.orgUnitId
    )
    const enrollmentQuery = useEnrollment(client, urlState.enrollmentId)

    const programs = useMemo(
        () =>
            (programsQuery.data?.programs ?? []).filter(
                (program) =>
                    program.programType === 'WITH_REGISTRATION' &&
                    hasCaptureProgramDataReadAccess(program)
            ),
        [programsQuery.data]
    )
    const program = programs.find(
        (candidate) => candidate.id === urlState.programId
    )
    const programOptions = useMemo(
        () =>
            buildProgramOptions({
                programs,
                selectedOrganisationUnitId: orgUnitQuery.data?.id,
                selectedOrganisationUnitPath: orgUnitQuery.data?.path,
                preservedProgramId: program?.id,
                baseUrl: runtimeConfig.baseUrl,
                apiVersion: runtimeConfig.apiVersion,
            }),
        [programs, orgUnitQuery.data, program?.id, runtimeConfig]
    )
    const stages = useMemo(() => stagesQuery.data ?? [], [stagesQuery.data])
    const stageOptions = useMemo<Option[]>(
        () =>
            stages.map((stage) => ({
                value: stage.id,
                label: stage.displayName,
            })),
        [stages]
    )
    const enrollmentOptions = useMemo(() => {
        const options = (enrollmentsQuery.data ?? []).map(enrollmentOption)
        const selected = enrollmentQuery.data
        return selected && !options.some((o) => o.value === selected.enrollment)
            ? [enrollmentOption(selected), ...options]
            : options
    }, [enrollmentsQuery.data, enrollmentQuery.data])
    const stage = stages.find((s) => s.id === urlState.programStageId)

    const context = program && urlState.orgUnitId ? program : undefined
    const formOpen =
        urlState.view === 'form' &&
        Boolean(urlState.enrollmentId && urlState.programStageId)

    const startForm = (programStageId: string) => {
        setNotice(undefined)
        navigate(withForm(urlState, { programStageId }))
    }
    const openRow = (target: WorkingListResultTarget) => {
        if (target.mode !== 'event') {
            return
        }
        setNotice(undefined)
        navigate(
            withForm(urlState, {
                programStageId: target.programStageId,
                eventId: target.eventId,
                enrollmentId: target.enrollmentId,
            })
        )
    }
    const backToList = () => navigate(withoutForm(urlState))
    const handleSaved = ({ outcome }: EventFormSavedResult) => {
        // The Working List keeps its result queries; refetch them so the list shows the change.
        void queryClient.invalidateQueries({
            queryKey: ['working-list', 'records'],
        })
        void queryClient.invalidateQueries({
            queryKey: ['working-list', 'tracked-entity-join'],
        })
        setNotice(outcome)
        backToList()
    }

    const renderForm = () =>
        urlState.programId &&
        urlState.orgUnitId &&
        urlState.enrollmentId &&
        urlState.programStageId ? (
            <DemoEventForm
                client={client}
                programId={urlState.programId}
                programStageId={urlState.programStageId}
                enrollmentId={urlState.enrollmentId}
                orgUnitId={urlState.orgUnitId}
                eventId={urlState.eventId}
                onSaved={handleSaved}
                onCancel={backToList}
            />
        ) : null

    const formHeading = urlState.eventId
        ? i18n.t('Edit event')
        : i18n.t('New event')
    const formTitle = stage
        ? `${formHeading} · ${stage.displayName}`
        : formHeading

    return (
        <div
            className="min-h-screen w-full min-w-0 max-w-full pb-10"
            data-testid="event-form-demo"
        >
            <ContextSelector ariaLabel={i18n.t('Event form context')}>
                <ProgramSelector
                    label={i18n.t('Program')}
                    placeholder={i18n.t('Choose a program')}
                    searchPlaceholder={i18n.t('Search for a program')}
                    options={programOptions}
                    value={program?.id}
                    open={openSelector === 'program'}
                    onOpenChange={(open) =>
                        setOpenSelector(open ? 'program' : undefined)
                    }
                    onChange={(programId) => {
                        setOpenSelector(undefined)
                        setNotice(undefined)
                        navigate(withProgram(urlState, programId))
                    }}
                    onClear={() => navigate(withProgram(urlState))}
                    loading={programsQuery.isPending}
                    loadingLabel={i18n.t('Loading tracker programs…')}
                />
                {program ? (
                    <DemoOrganisationUnitSelector
                        key={program.id}
                        client={client}
                        orgUnitId={urlState.orgUnitId}
                        open={openSelector === 'organisationUnit'}
                        onOpenChange={(open) =>
                            setOpenSelector(
                                open ? 'organisationUnit' : undefined
                            )
                        }
                        onSelect={(unit) => {
                            setOpenSelector(undefined)
                            setNotice(undefined)
                            navigate(withOrgUnit(urlState, unit.id))
                        }}
                        onClear={() => navigate(withOrgUnit(urlState))}
                    />
                ) : null}
                {context ? (
                    <EnrollmentSelector
                        label={i18n.t('Enrollment')}
                        placeholder={i18n.t('Choose an enrollment')}
                        options={enrollmentOptions}
                        value={urlState.enrollmentId}
                        open={openSelector === 'enrollment'}
                        onOpenChange={(open) =>
                            setOpenSelector(open ? 'enrollment' : undefined)
                        }
                        onChange={(enrollmentId) => {
                            setOpenSelector(undefined)
                            setNotice(undefined)
                            navigate(withEnrollment(urlState, enrollmentId))
                        }}
                        onClear={() => navigate(withEnrollment(urlState))}
                        loading={enrollmentsQuery.isPending}
                        loadingLabel={i18n.t('Loading enrollments…')}
                    />
                ) : null}
                {context ? (
                    <StageSelector
                        label={i18n.t('Stage')}
                        placeholder={i18n.t('Choose a stage')}
                        options={stageOptions}
                        value={urlState.programStageId}
                        open={openSelector === 'stage'}
                        onOpenChange={(open) =>
                            setOpenSelector(open ? 'stage' : undefined)
                        }
                        onChange={(programStageId) => {
                            setOpenSelector(undefined)
                            navigate(withStage(urlState, programStageId))
                        }}
                        onClear={() => navigate(withStage(urlState))}
                        loading={stagesQuery.isPending}
                        loadingLabel={i18n.t('Loading stages…')}
                    />
                ) : null}
                <ClearSelections
                    onClear={() => {
                        setOpenSelector(undefined)
                        setNotice(undefined)
                        navigate({})
                    }}
                    disabled={!urlState.programId && !urlState.orgUnitId}
                />
            </ContextSelector>

            <main className="mx-auto mt-4 flex w-full min-w-0 max-w-[1440px] flex-col gap-4 px-6 [@media(max-width:900px)]:px-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="m-0 text-2xl font-medium text-[#212934]">
                        {i18n.t('Event form')}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4">
                        <Label>
                            <Switch
                                checked={focusMode}
                                disabled={formOpen}
                                onCheckedChange={setFocusMode}
                            />
                            {i18n.t('Focus mode')}
                        </Label>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                disabled={
                                    formOpen ||
                                    !urlState.enrollmentId ||
                                    stages.length === 0
                                }
                                render={<Button />}
                            >
                                {i18n.t('New event')}
                                <DropdownMenuTriggerArrow />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {stages.map((candidate) => (
                                    <DropdownMenuItem
                                        key={candidate.id}
                                        onClick={() => startForm(candidate.id)}
                                    >
                                        {candidate.displayName}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {notice && !formOpen ? (
                    <Alert variant="success" data-testid="event-form-notice">
                        <p className="m-0">
                            {notice === 'queued'
                                ? i18n.t('Saved on this device')
                                : i18n.t('Saved')}
                        </p>
                        <AlertAction>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setNotice(undefined)}
                            >
                                {i18n.t('Dismiss')}
                            </Button>
                        </AlertAction>
                    </Alert>
                ) : null}

                {!context ? (
                    <p className="m-0 text-sm text-[#4a5768]">
                        {i18n.t(
                            'Choose a program and an organisation unit, then an enrollment, to list its events and edit them with the event form.'
                        )}
                    </p>
                ) : (
                    <>
                        {!formOpen ? (
                            <p className="m-0 text-sm text-[#4a5768]">
                                {urlState.programStageId
                                    ? i18n.t(
                                          'Click an event to edit it, or use New event to add one to the chosen enrollment.'
                                      )
                                    : i18n.t(
                                          'Choose a stage to list its events. Click an event to edit it.'
                                      )}
                            </p>
                        ) : null}
                        {formOpen && !focusMode ? (
                            <section
                                className={formSurfaceClassName}
                                aria-labelledby="event-form-demo-title"
                                data-testid="event-form-panel"
                            >
                                <h2
                                    id="event-form-demo-title"
                                    className="mt-0 mb-4 text-xl font-medium"
                                >
                                    {formTitle}
                                </h2>
                                {renderForm()}
                            </section>
                        ) : null}
                        {/* Kept mounted behind the form so it keeps its place and refetches after a save. */}
                        <div hidden={formOpen}>
                            <WorkingList
                                key={`${context.id}/${urlState.orgUnitId}`}
                                programId={context.id}
                                orgUnitId={urlState.orgUnitId ?? ''}
                            >
                                <ListStageBridge
                                    stageId={urlState.programStageId}
                                />
                                <WorkingListViewSwitcher />
                                <WorkingListToolbar>
                                    <WorkingListColumnSelector />
                                    <WorkingListFilterControls />
                                    <WorkingListToolbarActions />
                                </WorkingListToolbar>
                                <WorkingListTable onRowClick={openRow} />
                            </WorkingList>
                        </div>
                    </>
                )}
            </main>

            <Dialog open={formOpen && focusMode} onOpenChange={() => undefined}>
                <DialogContent
                    size="fluid"
                    position="top"
                    showCloseButton={false}
                    className="top-4 h-[calc(100vh-32px)] max-h-none w-[calc(100vw-32px)] max-w-none overflow-auto"
                    // Start on the title, not on the first field, whose date picker would open.
                    initialFocus={() =>
                        document.getElementById('event-form-demo-focus-title')
                    }
                    data-testid="event-form-panel"
                >
                    <DialogHeader>
                        <DialogTitle
                            id="event-form-demo-focus-title"
                            tabIndex={-1}
                        >
                            {formTitle}
                        </DialogTitle>
                    </DialogHeader>
                    {renderForm()}
                </DialogContent>
            </Dialog>

            <footer className="mx-auto mt-8 flex w-full max-w-[1440px] justify-end px-6 [@media(max-width:900px)]:px-3">
                <a
                    className="text-xs text-[#6c7787] underline-offset-2 hover:text-[#147cd7] hover:underline"
                    href="#/"
                >
                    {i18n.t('Back to Working List')}
                </a>
            </footer>
        </div>
    )
}
