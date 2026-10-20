import { Result } from 'better-result'
import type { ObservationsClient } from './client'
import {
    DataElementsResponseSchema,
    EventsResponseSchema,
    ProgramStagesResponseSchema,
} from './schemas'
import type {
    DataElementMetadata,
    StageMetadata,
    TrackerEventRecord,
} from './types'

export const EVENTS_PAGE_SIZE = 200

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
                fields: 'id,displayName,displayFormName,valueType,legendSets[legends[name,color,startValue,endValue]],optionSet[options[code,name,style[color]]]',
            },
        },
        DataElementsResponseSchema,
        signal
    )
}

/** Requests successive pages until one returns fewer than the page size. */
export const fetchEvents = async (
    client: ObservationsClient,
    {
        trackedEntityId,
        programId,
    }: { trackedEntityId: string; programId: string },
    signal?: AbortSignal
): Promise<Result<TrackerEventRecord[], Error>> => {
    const events: TrackerEventRecord[] = []
    for (let page = 1; ; page++) {
        const result = await client.query(
            {
                resource: 'tracker/events',
                params: {
                    trackedEntity: trackedEntityId,
                    program: programId,
                    fields: 'event,programStage,status,occurredAt,createdAt,dataValues[dataElement,value]',
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
        events.push(...result.value)
        if (result.value.length < EVENTS_PAGE_SIZE) {
            return Result.ok(events)
        }
    }
}
