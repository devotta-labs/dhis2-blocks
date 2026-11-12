import { FetchError, useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import {
    EnrollmentsResponseSchema,
    EventsResponseSchema,
    ProgramMetadataResponseSchema,
} from './schemas'
import type { ProgramMetadata, TrackerEventRecord } from './types'

type DataEngine = ReturnType<typeof useDataEngine>

export const EVENTS_PAGE_SIZE = 200
/** More pages than this is an error rather than a silently shortened history. */
export const EVENTS_MAX_PAGES = 50

interface Subject {
    trackedEntity: string
    program: string
}

const DATA_ELEMENT_FIELDS =
    'id,displayName,displayFormName,valueType,legendSets[legends[displayName~rename(name),color,startValue,endValue]],optionSet[options[code,displayName~rename(name),style[color]]]'

/**
 * Only a failed request is retried, twice, and only when the server or the
 * network failed. A malformed response, a client error and the data rules'
 * own errors (no enrollment, too many events) would fail the same way again.
 */
export const shouldRetryRequest = (failureCount: number, error: Error) =>
    failureCount < 2 &&
    error instanceof FetchError &&
    error.type !== 'access' &&
    (error.details.httpStatusCode === undefined ||
        error.details.httpStatusCode >= 500)

/**
 * Every stage of the program with the data elements it captures, in one
 * request, so no card has to say which elements it shows.
 */
const fetchProgramMetadata = async (
    engine: DataEngine,
    program: string,
    signal: AbortSignal
): Promise<ProgramMetadata> => {
    const { metadata } = await engine.query(
        {
            metadata: {
                resource: 'programs',
                id: program,
                params: {
                    fields: `programStages[id,displayName,access[data[read]],programStageDataElements[dataElement[${DATA_ELEMENT_FIELDS}]]]`,
                },
            },
        },
        { signal }
    )
    return ProgramMetadataResponseSchema.parse(metadata)
}

/**
 * No enrollment at all means the user cannot see the person in the program
 * (ownership, sharing, never enrolled), which must not read as "never
 * recorded", so it is an error.
 */
const requireEnrollment = async (
    engine: DataEngine,
    { trackedEntity, program }: Subject,
    signal: AbortSignal
): Promise<void> => {
    const { enrollments } = await engine.query(
        {
            enrollments: {
                resource: 'tracker/enrollments',
                params: {
                    trackedEntity,
                    program,
                    fields: 'enrollment',
                    pageSize: 1,
                },
            },
        },
        { signal }
    )
    if (EnrollmentsResponseSchema.parse(enrollments).length === 0) {
        throw new Error('This person has no visible enrollment in this program')
    }
}

/**
 * Requests successive pages, in a stable order, until one returns fewer than
 * the page size. An event repeated across pages is kept once, and an event
 * that names another tracked entity is dropped. Still full after
 * EVENTS_MAX_PAGES pages, one more page is asked for only to learn whether
 * the history ends there; any event on it is an error.
 */
const fetchEvents = async (
    engine: DataEngine,
    { trackedEntity, program }: Subject,
    signal: AbortSignal
): Promise<TrackerEventRecord[]> => {
    const events = new Map<string, TrackerEventRecord>()
    for (let page = 1; page <= EVENTS_MAX_PAGES + 1; page++) {
        const response = await engine.query(
            {
                events: {
                    resource: 'tracker/events',
                    params: {
                        trackedEntity,
                        program,
                        fields: 'event,trackedEntity,programStage,status,occurredAt,createdAt,dataValues[dataElement,value]',
                        order: 'occurredAt:asc,createdAt:asc',
                        pageSize: EVENTS_PAGE_SIZE,
                        page,
                    },
                },
            },
            { signal }
        )
        const received = EventsResponseSchema.parse(response.events)
        if (page > EVENTS_MAX_PAGES && received.length > 0) {
            break
        }
        for (const event of received) {
            const owner = event.trackedEntity
            if (
                (owner === undefined || owner === trackedEntity) &&
                !events.has(event.event)
            ) {
                events.set(event.event, event)
            }
        }
        if (received.length < EVENTS_PAGE_SIZE) {
            return [...events.values()]
        }
    }
    throw new Error(
        `Too many events: tracked entity ${trackedEntity} has at least ${EVENTS_MAX_PAGES} full pages of ${EVENTS_PAGE_SIZE} events in program ${program}`
    )
}

/** The program's stages and data elements, shared by every card of the program. */
export const useProgramMetadata = (program: string) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: ['observation-cards', 'programMetadata', program],
        queryFn: ({ signal }) => fetchProgramMetadata(engine, program, signal),
        // Nothing to ask for yet, so the cards stay pending.
        enabled: program !== '',
        retry: shouldRetryRequest,
    })
}

/** Every event of the person in the program, shared by every card of the person. */
export const usePersonEvents = ({ trackedEntity, program }: Subject) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: ['observation-cards', 'events', trackedEntity, program],
        queryFn: async ({ signal }) => {
            const subject = { trackedEntity, program }
            const [events] = await Promise.all([
                fetchEvents(engine, subject, signal),
                requireEnrollment(engine, subject, signal),
            ])
            return events
        },
        enabled: trackedEntity !== '' && program !== '',
        retry: shouldRetryRequest,
    })
}
