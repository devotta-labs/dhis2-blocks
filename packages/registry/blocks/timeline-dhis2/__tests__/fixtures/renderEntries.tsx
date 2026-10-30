import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import type { Dhis2Calendar } from '@/components/dhis2-value-display/calendar'
import { TimelineMetaProvider } from '@/components/timeline/ui/TimelineContext'
import { toProgramInfo } from '../../metadata'
import {
    EventsPageSchema,
    OrgUnitNamesSchema,
    ProgramTimelineMetadataSchema,
    type TrackerEvent,
} from '../../schemas'
import { eventEntry } from '../../toEntries'
import type { ProgramInfo } from '../../types'
import page1 from './v43/events-page-1.json'
import page2 from './v43/events-page-2.json'
import orgUnitNames from './v43/org-unit-names.json'
import programMetadata from './v43/program-metadata.json'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const TODAY = '2026-10-22'
export const NOW = new Date(2026, 9, 22, 12, 0)

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

/** The recorded program as the hooks resolve it, after `edit` changes a copy. */
/** A stage of the recorded program's metadata, to edit before resolving it. */
export const stageOf = (metadata: ProgramMetadata, id: string) => {
    const stage = metadata.programStages.find(
        (candidate) => candidate.id === id
    )
    if (stage === undefined) {
        throw new Error(`no stage ${id}`)
    }
    return stage
}

export const recordedProgram = (
    edit?: (metadata: ProgramMetadata) => void
): ProgramInfo => {
    const metadata: ProgramMetadata = JSON.parse(
        JSON.stringify(programMetadata)
    )
    edit?.(metadata)
    return toProgramInfo(ProgramTimelineMetadataSchema.parse(metadata))
}

const ORG_UNIT_NAMES: ReadonlyMap<string, string> = new Map(
    OrgUnitNamesSchema.parse(orgUnitNames).map(({ id, displayName }) => [
        id,
        displayName,
    ])
)

/** An event entry as `useEventEntries` builds it; `program: undefined` is metadata that failed. */
export const eventEntryOf = (
    event: TrackerEvent,
    { program = recordedProgram() }: { program?: ProgramInfo | null } = {}
) =>
    eventEntry(event, {
        timeField: 'occurredAt',
        today: TODAY,
        program: program ?? undefined,
        orgUnitNames: ORG_UNIT_NAMES,
    })

export const notFound = () =>
    new FetchError({
        type: 'unknown',
        message: 'An unknown error occurred - Not Found (404)',
        details: { httpStatusCode: 404 },
    })

export interface RenderOptions {
    /** The changelog answer per event id. */
    changelogs?: Record<string, ChangeLogs>
    /** Events whose changelog request fails with this error instead. */
    changelogErrors?: Record<string, Error>
    calendar?: Dhis2Calendar
    locale?: string
}

/**
 * Renders entry parts with no Timeline around them, only the meta provider
 * and a fake engine for the changelogs: parts render anywhere.
 */
export const renderEntries = async (
    ui: ReactNode,
    options: RenderOptions = {}
) => {
    const changelogRequests: string[] = []
    const data: CustomData = {}
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
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const result = await render(
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                <TimelineMetaProvider
                    calendar={options.calendar ?? 'gregorian'}
                    locale={options.locale ?? 'en'}
                    now={NOW}
                >
                    {ui}
                </TimelineMetaProvider>
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { ...result, changelogRequests }
}
