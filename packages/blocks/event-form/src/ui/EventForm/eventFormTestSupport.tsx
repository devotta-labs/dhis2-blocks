import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { expect, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import {
    rmnchEnrollmentResponse,
    rmnchResponses,
} from '../../../../program-rules/test/rmnch'
import eventFixture from '../../api/__fixtures__/event.json'
import stageFixture from '../../api/__fixtures__/rmnch-stage.json'
import type { EventPayload } from '../../save/payload'
import type { EventWriter } from '../../save/writer'
import { EventFormActions } from '../EventFormActions'
import { EventFormDetails } from '../EventFormDetails'
import { EventFormFeedback } from '../EventFormFeedback'
import { EventFormNotes } from '../EventFormNotes'
import { EventFormSectionNav } from '../EventFormSectionNav'
import { EventFormSections } from '../EventFormSections'
import { EventFormTextProvider } from '../EventFormText'
import { interpolate } from '../fields/fieldTestSupport'
import {
    useEventFormActions,
    useEventFormRules,
    useEventFormState,
} from '../hooks'
import { EventForm } from './EventForm'
import type {
    EventFormCommands,
    EventFormRules,
    EventFormState,
} from './EventFormContext'

/* Shared by the EventForm browser tests. Not a test itself, so it avoids the vitest globals. */

export const RMNCH = {
    programId: 'WSGAb5XwJ3Y',
    stageId: 'WZbXY0S00lP',
    enrollmentId: 'PE6abx7Zhn0',
    eventId: 'Evahwp3zrQ4',
    orgUnitId: 'm7fBMpmVpSM',
    chronic: 'de0FEHSIoxh',
    chronicFollowUps: [
        'xPTngRLQTnu',
        'sdchiIXIcCf',
        'VFffa31SKjH',
        'Q1x1HIhuwFN',
        'zzGNbeMnTd6',
        'UQ2Zo8CruPB',
    ],
    lmp: 'w4ky6EkVahL',
    gestationalAge: 'roKuXYfw1BW',
    smoking: 'sWoqcoByYmD',
    aspirin: 'OSuxnldV4Ug',
    diastolic: 'dyYdfamSY2Z',
} as const

type Json = z.infer<ReturnType<typeof z.json>>

type CustomData = ComponentProps<typeof CustomDataProvider>['data']
type ResourceFactory = Extract<CustomData[string], (...args: never[]) => void>
/** What app-runtime passes a custom resource: the resolved query, with any mutation data. */
type ResourceQuery = Parameters<ResourceFactory>[1]

/** Plain JSON, as it arrives over the wire. */
const wire = <T,>(value: T): Json =>
    z.json().parse(JSON.parse(JSON.stringify(value)))

type StageResponse = typeof stageFixture
type EventResponse = typeof eventFixture
type RulesResponse = typeof rmnchResponses.rules

/** The label of a stage data element in the RMNCH fixture. */
export const labelOf = (id: string): string => {
    const entry = stageFixture.programStages
        .flatMap((stage) => stage.programStageDataElements)
        .find((element) => element.dataElement.id === id)
    if (entry === undefined) {
        throw new Error(`No data element ${id} in the stage fixture`)
    }
    return entry.dataElement.displayFormName
}

/** Each override returns the response to serve, as plain data. */
export interface ServeOptions {
    stage?: (stage: StageResponse) => object
    event?: (event: EventResponse) => object
    rules?: (rules: RulesResponse) => object
    /** The tracker import endpoint: resolve with a report, or throw. */
    importEvent?: (payload: EventPayload) => Promise<Json>
}

const OK_REPORT = {
    status: 'OK',
    stats: { created: 1, updated: 0, deleted: 0, ignored: 0, total: 1 },
    validationReport: { errorReports: [] },
}

/** The DHIS2 API as the form, the rules hook and the org unit field query it. */
const serve = (options: ServeOptions) => {
    const payloads: EventPayload[] = []
    const stage = options.stage?.(stageFixture) ?? stageFixture
    const event = options.event?.(eventFixture) ?? eventFixture
    const rules = options.rules?.(rmnchResponses.rules) ?? rmnchResponses.rules
    const data = {
        programs: async (_type: string, query: ResourceQuery) =>
            wire(
                String(query.params?.fields).includes(
                    'programStageDataElements'
                )
                    ? stage
                    : rmnchResponses.program
            ),
        'tracker/events': async () => wire(event),
        'system/info': async () =>
            wire({ calendar: 'iso8601', dateFormat: 'yyyy-mm-dd' }),
        me: async () =>
            wire({
                ...rmnchResponses.me,
                organisationUnits: [{ id: 'ImspTQPwCqd' }],
            }),
        programRules: async () => wire(rules),
        programRuleVariables: async () => wire(rmnchResponses.variables),
        constants: async () => wire(rmnchResponses.constants),
        organisationUnitGroups: async () =>
            wire({
                organisationUnitGroups: [
                    {
                        id: 'EYbopBOJWsW',
                        code: 'MCHP',
                        organisationUnits: [{ id: RMNCH.orgUnitId }],
                    },
                ],
            }),
        'tracker/enrollments': async () => wire(rmnchEnrollmentResponse),
        organisationUnits: async (_type: string, query: ResourceQuery) =>
            wire({
                id: query.id,
                displayName: 'Kolisokor MCHP',
                path: `/ImspTQPwCqd/${query.id}`,
                ancestors: [{ displayName: 'Sierra Leone' }],
            }),
        tracker: async (_type: string, query: ResourceQuery) => {
            const payload = z
                .custom<EventPayload>((value) => value !== undefined)
                .parse(query.data)
            payloads.push(payload)
            return options.importEvent
                ? options.importEvent(payload)
                : wire(OK_REPORT)
        },
    }
    return { data, payloads }
}

interface Probe {
    state?: EventFormState
    rules?: EventFormRules
    actions?: EventFormCommands
}

/** Reads the public hooks into `probe`, so a test can assert on them. */
const StateProbe = ({ probe }: { probe: Probe }) => {
    probe.state = useEventFormState()
    probe.rules = useEventFormRules()
    probe.actions = useEventFormActions()
    return null
}

export interface RenderOptions extends ServeOptions {
    eventId?: string
    writer?: EventWriter
    /** What to render inside EventForm; the full composition by default. */
    children?: ReactNode
}

export const renderEventForm = async (options: RenderOptions = {}) => {
    const { data, payloads } = serve(options)
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const probe: Probe = {}
    const onSaved = vi.fn()
    const onCancel = vi.fn()
    const children = options.children ?? (
        <>
            <EventFormDetails />
            <EventFormSectionNav />
            <EventFormSections />
            <EventFormNotes />
            <EventFormFeedback />
            <EventFormActions />
        </>
    )
    const screen = await render(
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                <EventFormTextProvider translate={interpolate}>
                    <EventForm
                        programId={RMNCH.programId}
                        programStageId={RMNCH.stageId}
                        enrollmentId={RMNCH.enrollmentId}
                        orgUnitId={RMNCH.orgUnitId}
                        eventId={options.eventId}
                        writer={options.writer}
                        onSaved={onSaved}
                        onCancel={onCancel}
                    >
                        <StateProbe probe={probe} />
                        {children}
                    </EventForm>
                </EventFormTextProvider>
            </QueryClientProvider>
        </CustomDataProvider>
    )
    await expect
        .poll(() => probe.rules?.status, { timeout: 15_000 })
        .toBe('ready')
    return { screen, probe, payloads, onSaved, onCancel, queryClient }
}

/** The toggle group or radio group of a field. */
export const answerGroup = (id: string) =>
    page.getByRole('group', { name: labelOf(id), exact: true })

export const textbox = (id: string) =>
    page.getByRole('textbox', { name: labelOf(id), exact: true })

/** Local `yyyy-MM-dd`, as the form defaults the report date. */
export const today = () => {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The event that was posted last. */
export const lastEvent = (payloads: readonly EventPayload[]) => {
    const payload = payloads.at(-1)
    if (payload === undefined) {
        throw new Error('Nothing was posted')
    }
    return payload.events[0]
}

export const valueSent = (
    payloads: readonly EventPayload[],
    dataElement: string
) =>
    lastEvent(payloads).dataValues.find(
        (value) => value.dataElement === dataElement
    )
