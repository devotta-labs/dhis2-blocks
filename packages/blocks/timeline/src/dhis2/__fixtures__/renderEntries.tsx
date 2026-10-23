import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import type { Dhis2Calendar } from '@/registry/dhis2/value-display/calendar'
import type { TimelineEntry } from '../../core/types'
import {
    actionsOf,
    META,
    source,
    TODAY,
} from '../../ui/__fixtures__/timelineFixtures'
import { buildTimelineState, TimelineProvider } from '../../ui/TimelineContext'
import { EventsPageSchema, type TrackerEvent } from '../schemas'
import { TimelineDhis2Provider } from '../TimelineDhis2Provider'
import { toEventEntry } from '../toEventEntry'
import page1 from './v43/events-page-1.json'
import page2 from './v43/events-page-2.json'
import orgUnitNames from './v43/org-unit-names.json'
import programMetadata from './v43/program-metadata.json'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const PROGRAM = 'WSGAb5XwJ3Y'

export const ChangeLogsSchema = z.object({ changeLogs: z.array(z.json()) })

type ChangeLogs = z.infer<typeof ChangeLogsSchema>

/** The first element matching `selector`, which the test expects to exist. */
export const elementIn = (
    container: HTMLElement,
    selector: string
): HTMLElement => {
    const found = container.querySelector(selector)
    if (!(found instanceof HTMLElement)) {
        throw new Error(`no element matches ${selector}`)
    }
    return found
}

export const buttonIn = (container: HTMLElement): HTMLButtonElement => {
    const found = container.querySelector('button')
    if (found === null) {
        throw new Error('no button')
    }
    return found
}

/** The recorded events by id. */
const recordedEvents: Record<string, TrackerEvent> = Object.fromEntries(
    [...EventsPageSchema.parse(page1), ...EventsPageSchema.parse(page2)].map(
        (event) => [event.event, event]
    )
)

export const recordedEvent = (id: string): TrackerEvent => {
    const found = recordedEvents[id]
    if (found === undefined) {
        throw new Error(`no recorded event ${id}`)
    }
    return found
}

export const eventEntryOf = (event: TrackerEvent) =>
    toEventEntry(event, {
        sourceKey: 'events',
        timeField: 'occurredAt',
        today: TODAY,
    })

/** The parts of the recorded program metadata a test edits. */
export interface ProgramMetadata {
    programStages: Array<{
        id: string
        hideDueDate: boolean
        programStageDataElements: Array<{
            displayInReports: boolean
            dataElement: {
                id: string
                displayName: string
                displayFormName?: string
                valueType: string
                optionSet?: {
                    options: Array<{ code: string; displayName: string }>
                }
            }
        }>
    }>
}

export const notFound = () =>
    new FetchError({
        type: 'unknown',
        message: 'An unknown error occurred - Not Found (404)',
        details: { httpStatusCode: 404 },
    })

export interface RenderOptions {
    /** The feed the timeline holds, for the org unit names. */
    entries?: TimelineEntry<unknown>[]
    /** Edits a copy of the recorded program metadata. */
    metadata?: (metadata: ProgramMetadata) => void
    /** The changelog answer per event id. */
    changelogs?: Record<string, ChangeLogs>
    /** Events whose changelog request fails with this error instead. */
    changelogErrors?: Record<string, Error>
    /** Delays the program metadata answer. */
    metadataDelayMs?: number
    /** `none` renders `ui` as is, for parts that bring their own list. */
    layout?: 'list' | 'none'
    calendar?: Dhis2Calendar
    locale?: string
}

/** Renders inside a hand-written timeline and a fake engine of the recorded answers. */
export const renderEntries = async (
    ui: ReactNode,
    options: RenderOptions = {}
) => {
    const metadata: ProgramMetadata = JSON.parse(
        JSON.stringify(programMetadata)
    )
    options.metadata?.(metadata)
    const changelogRequests: string[] = []
    const data: CustomData = {
        programs: async () => {
            await new Promise((resolve) =>
                setTimeout(resolve, options.metadataDelayMs ?? 0)
            )
            return z.json().parse(metadata)
        },
        organisationUnits: async () => z.json().parse(orgUnitNames),
    }
    for (const [event, body] of Object.entries(options.changelogs ?? {})) {
        data[`tracker/events/${event}/changeLogs`] = async () => {
            changelogRequests.push(event)
            return body
        }
    }
    for (const [event, error] of Object.entries(
        options.changelogErrors ?? {}
    )) {
        data[`tracker/events/${event}/changeLogs`] = async () => {
            changelogRequests.push(event)
            throw error
        }
    }
    const meta = {
        ...META,
        calendar: options.calendar ?? META.calendar,
        locale: options.locale ?? META.locale,
    }
    const state = buildTimelineState<unknown>(
        {
            entries: options.entries ?? [],
            status: 'ready',
            sources: [source('events', 'complete')],
            hasMore: false,
            loadingMore: false,
            loadMore: () => undefined,
            retry: () => undefined,
        },
        {
            order: meta.order,
            groupBy: 'day',
            today: TODAY,
            calendar: meta.calendar,
            locale: meta.locale,
            labels: {
                overdue: 'Overdue',
                undated: 'Undated',
                allEntries: 'All',
            },
        }
    )
    const queryClient = new QueryClient()
    const result = await render(
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                <TimelineProvider
                    state={state}
                    actions={actionsOf()}
                    meta={meta}
                >
                    <TimelineDhis2Provider program={PROGRAM}>
                        {options.layout === 'none' ? ui : <ol>{ui}</ol>}
                    </TimelineDhis2Provider>
                </TimelineProvider>
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { ...result, changelogRequests }
}
