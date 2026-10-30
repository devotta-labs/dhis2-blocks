import { Result } from 'better-result'
import type { TimelineClient } from './client'
import {
    ChangeLogPageSchema,
    EventsPageSchema,
    OrgUnitNamesSchema,
    ProgramTimelineMetadataSchema,
    TrackedEntitySchema,
    type ChangeLogRow,
    type OrgUnitName,
    type ProgramTimelineMetadata,
    type TrackedEntity,
    type TrackerEvent,
} from './schemas'

// Parameters are the ones recorded in __tests__/fixtures/README.md; 2.41, 2.42 and
// 2.43 accept the same requests.

export type EventTimeField =
    | 'occurredAt'
    | 'scheduledAt'
    | 'completedAt'
    | 'createdAt'
    | 'updatedAt'

export const EVENT_FIELDS =
    'event,status,program,programStage,enrollment,trackedEntity,orgUnit,occurredAt,scheduledAt,completedAt,completedBy,createdAt,updatedAt,createdBy,updatedBy,dataValues[dataElement,value],notes[note,value,storedAt,storedBy,createdBy]'

const NOTE_FIELDS = 'notes[note,value,storedAt,storedBy,createdBy]'

const ENROLLMENT_FIELDS = `enrollments[enrollment,program,status,orgUnit,enrolledAt,occurredAt,completedAt,completedBy,createdAt,updatedAt,createdBy,updatedBy,${NOTE_FIELDS}]`

const VALUE_METADATA_FIELDS =
    'id,displayName,displayFormName,valueType,optionSet[options[code,displayName]]'

const PROGRAM_FIELDS = `id,displayName,displayEnrollmentDateLabel,displayIncidentDateLabel,programStages[id,displayName,sortOrder,hideDueDate,repeatable,programStageDataElements[displayInReports,dataElement[${VALUE_METADATA_FIELDS}]]],programTrackedEntityAttributes[trackedEntityAttribute[${VALUE_METADATA_FIELDS}]]`

export interface EventsResult {
    /** Newest first by the time field; events with no value in it come first. */
    events: TrackerEvent[]
    /** More events than `cap` exist; the oldest were left out. */
    capped: boolean
}

/**
 * One program's events of one tracked entity, every status, newest first by
 * `timeField` (the uid breaks ties), at most `cap`. 2.43 requires `program`,
 * so a person's history asks once per program. Asking for `cap + 1` tells
 * whether any were left out.
 */
export const fetchEvents = async (
    client: TimelineClient,
    {
        trackedEntity,
        program,
        timeField,
        cap,
    }: {
        trackedEntity: string
        program: string
        timeField: EventTimeField
        cap: number
    },
    signal?: AbortSignal
): Promise<Result<EventsResult, Error>> => {
    const result = await client.query(
        {
            resource: 'tracker/events',
            params: {
                trackedEntity,
                program,
                fields: EVENT_FIELDS,
                order: `${timeField}:desc,event:asc`,
                page: 1,
                pageSize: cap + 1,
            },
        },
        EventsPageSchema,
        signal
    )
    return result.map((events) => ({
        events: events.slice(0, cap),
        capped: events.length > cap,
    }))
}

/**
 * The tracked entity with its enrollments in every program the user can see,
 * and their notes. Without `program` the server answers every enrollment
 * (checked on 2.41.10 and 2.43.2).
 */
export const fetchTrackedEntity = (
    client: TimelineClient,
    { trackedEntity }: { trackedEntity: string },
    signal?: AbortSignal
): Promise<Result<TrackedEntity, Error>> =>
    client.query(
        {
            resource: 'tracker/trackedEntities',
            id: trackedEntity,
            params: {
                fields: `trackedEntity,trackedEntityType,orgUnit,${ENROLLMENT_FIELDS}`,
            },
        },
        TrackedEntitySchema,
        signal
    )

export interface ChangeLogResult {
    rows: ChangeLogRow[]
    /** More rows than `maxRows` exist; the oldest were left out. */
    truncated: boolean
}

const CHANGELOG_PAGE_SIZE = 100

/**
 * Every changelog row, newest first, a page at a time until the last page or
 * more than `maxRows`. "More pages" is "the page came back full", counted before rows
 * this block doesn't know were skipped.
 */
const fetchChangeLog = async (
    client: TimelineClient,
    resource: string,
    params: Record<string, string>,
    maxRows: number,
    signal?: AbortSignal
): Promise<Result<ChangeLogResult, Error>> => {
    const rows: ChangeLogRow[] = []
    for (let page = 1; ; page++) {
        const result = await client.query(
            {
                resource,
                params: {
                    ...params,
                    order: 'createdAt:desc',
                    page,
                    pageSize: CHANGELOG_PAGE_SIZE,
                },
            },
            ChangeLogPageSchema,
            signal
        )
        if (Result.isError(result)) {
            return Result.err(result.error)
        }
        rows.push(...result.value.rows)
        // More than `maxRows` read: some were left out. Exactly `maxRows`
        // on full pages asks once more, to tell "no more" from "more".
        if (rows.length > maxRows) {
            return Result.ok({ rows: rows.slice(0, maxRows), truncated: true })
        }
        if (result.value.received < CHANGELOG_PAGE_SIZE) {
            return Result.ok({ rows, truncated: false })
        }
    }
}

/**
 * Attribute value changes in one program, newest first. Without `program`
 * only the type's attributes come back, so a person's history asks once per
 * program and drops the rows the answers share.
 */
export const fetchAttributeChangeLog = (
    client: TimelineClient,
    {
        trackedEntity,
        program,
        maxRows,
    }: { trackedEntity: string; program: string; maxRows: number },
    signal?: AbortSignal
): Promise<Result<ChangeLogResult, Error>> =>
    fetchChangeLog(
        client,
        `tracker/trackedEntities/${trackedEntity}/changeLogs`,
        { program },
        maxRows,
        signal
    )

/** Data value changes (and, from 2.42, event field changes), newest first. */
export const fetchEventChangeLog = (
    client: TimelineClient,
    { event, maxRows }: { event: string; maxRows: number },
    signal?: AbortSignal
): Promise<Result<ChangeLogResult, Error>> =>
    fetchChangeLog(
        client,
        `tracker/events/${event}/changeLogs`,
        {},
        maxRows,
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
