import { queryOptions, skipToken } from '@tanstack/react-query'
import type { Result } from 'better-result'
import {
    shouldRetryEventFormRequest,
    type EventFormApiError,
    type EventFormClient,
} from './client'
import {
    ProgramResponseSchema,
    SystemCalendarSchema,
    toStageMetadata,
    TrackerEventSchema,
    type StageMetadata,
    type SystemCalendar,
    type TrackerEvent,
} from './schemas'

export const eventFormKeys = {
    all: ['event-form'] as const,
    stage: (programId: string, stageId: string) =>
        [...eventFormKeys.all, 'stage', programId, stageId] as const,
    event: (eventId: string) =>
        [...eventFormKeys.all, 'event', eventId] as const,
    systemInfo: () => [...eventFormKeys.all, 'system-info'] as const,
}

export const STAGE_METADATA_FIELDS =
    'id,displayName,programType,trackedEntityType[id],categoryCombo[id,isDefault],programStages[id,displayName,executionDateLabel,validationStrategy,blockEntryForm,featureType,repeatable,sortOrder,programStageSections[id,displayName,sortOrder,dataElements[id]],programStageDataElements[compulsory,sortOrder,allowFutureDate,renderType,dataElement[id,displayFormName,displayDescription,valueType,fieldMask,optionSetValue,optionSet[id,options[id,code,displayName,sortOrder]]]]]'

const TRACKER_EVENT_FIELDS =
    'event,program,programStage,enrollment,orgUnit,status,occurredAt,scheduledAt,geometry,dataValues[dataElement,value],notes'

const SYSTEM_CALENDAR_FIELDS = 'calendar,dateFormat'

const MINUTE = 60_000

export const fetchStageMetadata = async (
    client: EventFormClient,
    programId: string,
    stageId: string,
    signal?: AbortSignal
): Promise<Result<StageMetadata, EventFormApiError>> => {
    const program = await client.query(
        {
            resource: 'programs',
            id: programId,
            params: { fields: STAGE_METADATA_FIELDS },
        },
        ProgramResponseSchema,
        signal
    )
    return program.andThen((response) => toStageMetadata(response, stageId))
}

export const fetchTrackerEvent = (
    client: EventFormClient,
    eventId: string,
    signal?: AbortSignal
): Promise<Result<TrackerEvent, EventFormApiError>> =>
    client.query(
        {
            resource: 'tracker/events',
            id: eventId,
            params: { fields: TRACKER_EVENT_FIELDS },
        },
        TrackerEventSchema,
        signal
    )

export const fetchSystemCalendar = (
    client: EventFormClient,
    signal?: AbortSignal
): Promise<Result<SystemCalendar, EventFormApiError>> =>
    client.query(
        {
            resource: 'system/info',
            params: { fields: SYSTEM_CALENDAR_FIELDS },
        },
        SystemCalendarSchema,
        signal
    )

/** React Query wants a rejection, so a failed Result is thrown as its error. */
const unwrapOrThrow = async <T>(
    result: Promise<Result<T, EventFormApiError>>
): Promise<T> => {
    const settled = await result
    if (settled.isErr()) {
        throw settled.error
    }
    return settled.value
}

export const stageMetadataQueryOptions = (
    client: EventFormClient,
    programId: string,
    stageId: string
) =>
    queryOptions<
        StageMetadata,
        EventFormApiError,
        StageMetadata,
        ReturnType<typeof eventFormKeys.stage>
    >({
        queryKey: eventFormKeys.stage(programId, stageId),
        queryFn: ({ signal }) =>
            unwrapOrThrow(
                fetchStageMetadata(client, programId, stageId, signal)
            ),
        staleTime: 5 * MINUTE,
        retry: shouldRetryEventFormRequest,
    })

export const trackerEventQueryOptions = (
    client: EventFormClient,
    eventId: string | undefined
) =>
    queryOptions<
        TrackerEvent,
        EventFormApiError,
        TrackerEvent,
        ReturnType<typeof eventFormKeys.event>
    >({
        queryKey: eventFormKeys.event(eventId ?? ''),
        queryFn:
            eventId === undefined
                ? skipToken
                : ({ signal }) =>
                      unwrapOrThrow(fetchTrackerEvent(client, eventId, signal)),
        retry: shouldRetryEventFormRequest,
    })

export const systemCalendarQueryOptions = (client: EventFormClient) =>
    queryOptions<
        SystemCalendar,
        EventFormApiError,
        SystemCalendar,
        ReturnType<typeof eventFormKeys.systemInfo>
    >({
        queryKey: eventFormKeys.systemInfo(),
        queryFn: ({ signal }) =>
            unwrapOrThrow(fetchSystemCalendar(client, signal)),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        retry: shouldRetryEventFormRequest,
    })
