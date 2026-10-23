import { Result } from 'better-result'
import type { TimelineClient } from './client'
import {
    ChangeLogPageSchema,
    EventsPageSchema,
    OrgUnitNamesSchema,
    ProgramTimelineMetadataSchema,
    TrackedEntitySchema,
    type ChangeLogPage,
    type EventsPage,
    type OrgUnitName,
    type ProgramTimelineMetadata,
    type TrackedEntity,
    type TrackerEvent,
} from './schemas'

// Parameters are the ones recorded in __fixtures__/README.md; 2.41, 2.42 and
// 2.43 accept the same requests.

export type EventTimeField =
    | 'occurredAt'
    | 'scheduledAt'
    | 'completedAt'
    | 'createdAt'
    | 'updatedAt'

/**
 * Statuses fetched by fetchPinnedEvents and so left out of the past stream.
 * A stored legacy OVERDUE status stays in the past stream: `status=OVERDUE`
 * is answered with past-due SCHEDULE events, so pinned events never see it.
 */
const PINNED_STATUSES = new Set(['SCHEDULE', 'SKIPPED'])

export const EVENT_FIELDS =
    'event,status,program,programStage,enrollment,trackedEntity,orgUnit,occurredAt,scheduledAt,completedAt,completedBy,createdAt,updatedAt,createdBy,updatedBy,dataValues[dataElement,value],notes[note,value,storedAt,storedBy,createdBy]'

const NOTE_FIELDS = 'notes[note,value,storedAt,storedBy,createdBy]'

const ENROLLMENT_FIELDS = `enrollments[enrollment,program,status,orgUnit,enrolledAt,occurredAt,completedAt,completedBy,createdAt,updatedAt,createdBy,updatedBy,${NOTE_FIELDS}]`

const VALUE_METADATA_FIELDS =
    'id,displayName,displayFormName,valueType,optionSet[options[code,displayName]]'

const PROGRAM_FIELDS = `id,displayName,programStages[id,displayName,sortOrder,hideDueDate,repeatable,programStageDataElements[displayInReports,dataElement[${VALUE_METADATA_FIELDS}]]],programTrackedEntityAttributes[trackedEntityAttribute[${VALUE_METADATA_FIELDS}]]`

interface Subject {
    trackedEntity: string
    program: string
}

interface Paging {
    page: number
    pageSize: number
}

/**
 * One page of the past stream, newest first by `timeField`, with the event
 * uid breaking ties so pages never overlap. The uid runs ascending because the
 * merge breaks ties between entries of one instant by ascending id, so a page
 * boundary inside a tie only ever appends. No server version accepts more
 * than one `status`, so scheduled and skipped events are removed here; they
 * still count toward the page being full.
 */
export const fetchEventsPage = async (
    client: TimelineClient,
    {
        trackedEntity,
        program,
        timeField,
        page,
        pageSize,
    }: Subject & Paging & { timeField: EventTimeField },
    signal?: AbortSignal
): Promise<Result<EventsPage, Error>> => {
    const result = await client.query(
        {
            resource: 'tracker/events',
            params: {
                trackedEntity,
                program,
                fields: EVENT_FIELDS,
                order: `${timeField}:desc,event:asc`,
                page,
                pageSize,
            },
        },
        EventsPageSchema,
        signal
    )
    return result.map((events) => ({
        events: events.filter((event) => !PINNED_STATUSES.has(event.status)),
        hasMore: events.length >= pageSize,
        // From the raw rows: filtered rows still bound what was read.
        lastAt: events.at(-1)?.[timeField],
    }))
}

const byScheduledAt = (a: TrackerEvent, b: TrackerEvent) => {
    const left = a.scheduledAt ?? '￿'
    const right = b.scheduledAt ?? '￿'
    if (left !== right) {
        return left < right ? -1 : 1
    }
    return a.event < b.event ? -1 : a.event > b.event ? 1 : 0
}

export interface PinnedEvents {
    events: TrackerEvent[]
    /** More SCHEDULE events than the cap exist. */
    scheduleCapped: boolean
    /** More SKIPPED events than the cap exist. */
    skippedCapped: boolean
}

/**
 * Scheduled (including past-due) and skipped events, oldest scheduled date
 * first, at most `cap` of each status, so old skipped events never push out
 * upcoming ones. Each status is asked for `cap + 1` to tell whether any were
 * left out. `status=OVERDUE` is not asked for: servers answer it with the
 * past-due SCHEDULE events, which are already here.
 */
export const fetchPinnedEvents = async (
    client: TimelineClient,
    { trackedEntity, program, cap }: Subject & { cap: number },
    signal?: AbortSignal
): Promise<Result<PinnedEvents, Error>> => {
    const ask = (status: 'SCHEDULE' | 'SKIPPED') =>
        client.query(
            {
                resource: 'tracker/events',
                params: {
                    trackedEntity,
                    program,
                    status,
                    fields: EVENT_FIELDS,
                    order: 'scheduledAt:asc,event:asc',
                    page: 1,
                    pageSize: cap + 1,
                },
            },
            EventsPageSchema,
            signal
        )
    const [schedule, skipped] = await Promise.all([
        ask('SCHEDULE'),
        ask('SKIPPED'),
    ])
    if (Result.isError(schedule)) {
        return Result.err(schedule.error)
    }
    if (Result.isError(skipped)) {
        return Result.err(skipped.error)
    }
    const firstOf = (events: TrackerEvent[]) =>
        [...events].sort(byScheduledAt).slice(0, cap)
    const events = new Map<string, TrackerEvent>()
    for (const event of [
        ...firstOf(schedule.value),
        ...firstOf(skipped.value),
    ]) {
        events.set(event.event, event)
    }
    return Result.ok({
        events: [...events.values()].sort(byScheduledAt),
        scheduleCapped: schedule.value.length > cap,
        skippedCapped: skipped.value.length > cap,
    })
}

/**
 * The tracked entity with its enrollments in the program and their notes.
 * Enrollments in any other program are dropped, whatever the server sends.
 */
export const fetchTrackedEntityWithEnrollments = async (
    client: TimelineClient,
    { trackedEntity, program }: Subject,
    signal?: AbortSignal
): Promise<Result<TrackedEntity, Error>> => {
    const result = await client.query(
        {
            resource: 'tracker/trackedEntities',
            id: trackedEntity,
            params: {
                program,
                fields: `trackedEntity,trackedEntityType,orgUnit,${ENROLLMENT_FIELDS}`,
            },
        },
        TrackedEntitySchema,
        signal
    )
    return result.map((entity) => ({
        ...entity,
        enrollments: entity.enrollments.filter(
            (enrollment) => enrollment.program === program
        ),
    }))
}

const changeLogPage = async (
    client: TimelineClient,
    resource: string,
    params: Record<string, string>,
    { page, pageSize }: Paging,
    signal?: AbortSignal
): Promise<Result<ChangeLogPage, Error>> => {
    const result = await client.query(
        {
            resource,
            params: { ...params, order: 'createdAt:desc', page, pageSize },
        },
        ChangeLogPageSchema,
        signal
    )
    // Counted before unknown rows were skipped, so a skipped row cannot end
    // paging early.
    return result.map(({ rows, received }) => ({
        rows,
        hasMore: received >= pageSize,
    }))
}

/** Attribute value changes, newest first; `program` adds its attributes to the type's. */
export const fetchAttributeChangeLogPage = (
    client: TimelineClient,
    { trackedEntity, program, ...paging }: Subject & Paging,
    signal?: AbortSignal
): Promise<Result<ChangeLogPage, Error>> =>
    changeLogPage(
        client,
        `tracker/trackedEntities/${trackedEntity}/changeLogs`,
        { program },
        paging,
        signal
    )

/** Data value changes (and, from 2.42, event field changes), newest first. */
export const fetchEventChangeLogPage = (
    client: TimelineClient,
    { event, ...paging }: Paging & { event: string },
    signal?: AbortSignal
): Promise<Result<ChangeLogPage, Error>> =>
    changeLogPage(
        client,
        `tracker/events/${event}/changeLogs`,
        {},
        paging,
        signal
    )

export const fetchProgramTimelineMetadata = (
    client: TimelineClient,
    { program }: { program: string },
    signal?: AbortSignal
): Promise<Result<ProgramTimelineMetadata, Error>> =>
    client.query(
        {
            resource: 'programs',
            id: program,
            params: { fields: PROGRAM_FIELDS },
        },
        ProgramTimelineMetadataSchema,
        signal
    )

/** Names for all ids in one request. */
export const fetchOrgUnitNames = async (
    client: TimelineClient,
    { ids }: { ids: ReadonlyArray<string> },
    signal?: AbortSignal
): Promise<Result<OrgUnitName[], Error>> => {
    // An empty `id:in:[]` filter is not guaranteed to match nothing.
    if (ids.length === 0) {
        return Result.ok([])
    }
    return client.query(
        {
            resource: 'organisationUnits',
            params: {
                filter: `id:in:[${ids.join(',')}]`,
                fields: 'id,displayName',
                paging: false,
            },
        },
        OrgUnitNamesSchema,
        signal
    )
}
