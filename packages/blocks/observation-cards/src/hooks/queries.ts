import { Result } from 'better-result'
import type { ObservationsClient } from './client'
import {
    DataElementsResponseSchema,
    EnrollmentsResponseSchema,
    EventsResponseSchema,
    ProgramStagesResponseSchema,
} from './schemas'
import type {
    DataElementMetadata,
    StageMetadata,
    TrackerEventRecord,
} from './types'

export const EVENTS_PAGE_SIZE = 200
/** More pages than this is an error rather than a silently shortened history. */
export const EVENTS_MAX_PAGES = 50

const NO_ENROLLMENT_MESSAGE =
    'This person has no visible enrollment in this program'

interface Subject {
    trackedEntityId: string
    programId: string
}

export const fetchStages = (
    client: ObservationsClient,
    programId: string,
    signal?: AbortSignal
): Promise<Result<StageMetadata[], Error>> =>
    client.query(
        {
            resource: 'programs',
            id: programId,
            params: {
                fields: 'programStages[id,displayName,access[data[read]],programStageDataElements[dataElement[id]]]',
            },
        },
        ProgramStagesResponseSchema,
        signal
    )

export const fetchDataElements = async (
    client: ObservationsClient,
    ids: string[],
    signal?: AbortSignal
): Promise<Result<DataElementMetadata[], Error>> => {
    // An empty `id:in:[]` filter is not guaranteed to match nothing.
    if (ids.length === 0) {
        return Result.ok([])
    }
    return client.query(
        {
            resource: 'dataElements',
            params: {
                filter: `id:in:[${ids.join(',')}]`,
                paging: false,
                fields: 'id,displayName,displayFormName,valueType,legendSets[legends[displayName~rename(name),color,startValue,endValue]],optionSet[options[code,displayName~rename(name),style[color]]]',
            },
        },
        DataElementsResponseSchema,
        signal
    )
}

/**
 * One enrollment of the person in the program. None at all means the user
 * cannot see the person there (ownership, sharing, never enrolled), which must
 * not read as "never recorded", so it is an error.
 */
export const fetchEnrollment = async (
    client: ObservationsClient,
    { trackedEntityId, programId }: Subject,
    signal?: AbortSignal
): Promise<Result<string, Error>> => {
    const result = await client.query(
        {
            resource: 'tracker/enrollments',
            params: {
                trackedEntity: trackedEntityId,
                program: programId,
                fields: 'enrollment',
                pageSize: 1,
            },
        },
        EnrollmentsResponseSchema,
        signal
    )
    return result.andThen(([first]) =>
        first === undefined
            ? Result.err(new Error(NO_ENROLLMENT_MESSAGE))
            : Result.ok(first.enrollment)
    )
}

/**
 * Requests successive pages, in a stable order, until one returns fewer than
 * the page size. An event repeated across pages is kept once, and an event
 * that names another tracked entity is dropped. Still full after
 * EVENTS_MAX_PAGES pages is an error.
 */
export const fetchEvents = async (
    client: ObservationsClient,
    { trackedEntityId, programId }: Subject,
    signal?: AbortSignal
): Promise<Result<TrackerEventRecord[], Error>> => {
    const events = new Map<string, TrackerEventRecord>()
    for (let page = 1; page <= EVENTS_MAX_PAGES; page++) {
        const result = await client.query(
            {
                resource: 'tracker/events',
                params: {
                    trackedEntity: trackedEntityId,
                    program: programId,
                    fields: 'event,trackedEntity,programStage,status,occurredAt,createdAt,dataValues[dataElement,value]',
                    order: 'occurredAt:asc,createdAt:asc',
                    pageSize: EVENTS_PAGE_SIZE,
                    page,
                },
            },
            EventsResponseSchema,
            signal
        )
        if (Result.isError(result)) {
            return Result.err(result.error)
        }
        for (const event of result.value) {
            const owner = event.trackedEntity
            if (
                (owner === undefined || owner === trackedEntityId) &&
                !events.has(event.event)
            ) {
                events.set(event.event, event)
            }
        }
        if (result.value.length < EVENTS_PAGE_SIZE) {
            return Result.ok([...events.values()])
        }
    }
    return Result.err(
        new Error(
            `Too many events: tracked entity ${trackedEntityId} has at least ${EVENTS_MAX_PAGES} full pages of ${EVENTS_PAGE_SIZE} events in program ${programId}`
        )
    )
}
