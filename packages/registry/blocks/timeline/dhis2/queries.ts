import { FetchError, type useDataEngine } from '@dhis2/app-runtime'
import {
    ChangeLogPageSchema,
    EVENT_FIELDS,
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

export type DataEngine = ReturnType<typeof useDataEngine>

export type EventTimeField =
    | 'occurredAt'
    | 'scheduledAt'
    | 'completedAt'
    | 'createdAt'
    | 'updatedAt'

const NOTE_FIELDS = 'notes[note,value,storedAt,storedBy,createdBy]'

const ENROLLMENT_FIELDS = `enrollments[enrollment,program,status,orgUnit,enrolledAt,occurredAt,completedAt,completedBy,createdAt,updatedAt,createdBy,updatedBy,${NOTE_FIELDS}]`

const VALUE_METADATA_FIELDS =
    'id,displayName,displayFormName,valueType,optionSet[options[code,displayName]]'

const PROGRAM_FIELDS = `id,displayName,displayEnrollmentDateLabel,displayIncidentDateLabel,programStages[id,displayName,sortOrder,hideDueDate,repeatable,programStageDataElements[displayInReports,dataElement[${VALUE_METADATA_FIELDS}]]],programTrackedEntityAttributes[trackedEntityAttribute[${VALUE_METADATA_FIELDS}]]`

/**
 * A failed request is retried twice, and only when the server or the network
 * failed: a malformed response or a client error would fail the same way
 * again.
 */
export const shouldRetryRequest = (failureCount: number, error: Error) =>
    failureCount < 2 &&
    error instanceof FetchError &&
    error.type !== 'access' &&
    (error.details.httpStatusCode === undefined ||
        error.details.httpStatusCode >= 500)

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
    engine: DataEngine,
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
): Promise<EventsResult> => {
    const { page } = await engine.query(
        {
            page: {
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
        },
        { signal }
    )
    const events = EventsPageSchema.parse(page)
    return { events: events.slice(0, cap), capped: events.length > cap }
}

/**
 * The tracked entity with its enrollments in every program the user can see,
 * and their notes. Without `program` the server answers every enrollment
 * (checked on 2.41.10 and 2.43.2).
 */
export const fetchTrackedEntity = async (
    engine: DataEngine,
    { trackedEntity }: { trackedEntity: string },
    signal?: AbortSignal
): Promise<TrackedEntity> => {
    const { entity } = await engine.query(
        {
            entity: {
                resource: 'tracker/trackedEntities',
                id: trackedEntity,
                params: {
                    fields: `trackedEntity,trackedEntityType,orgUnit,${ENROLLMENT_FIELDS}`,
                },
            },
        },
        { signal }
    )
    return TrackedEntitySchema.parse(entity)
}

export interface ChangeLogResult {
    rows: ChangeLogRow[]
    /** More than 500 rows exist; the oldest were left out. */
    truncated: boolean
    /** The server has no changelog endpoint: it answered 404. */
    unsupported: boolean
}

const CHANGELOG_PAGE_SIZE = 100

/** Most changelog rows read for one event or one program's attributes. */
const CHANGELOG_MAX_ROWS = 500

/**
 * The status is in the JSON body, or only in the message when the body wasn't
 * JSON (a proxy's own 404 page).
 */
const isNotFound = (error: FetchError) =>
    error.details.httpStatusCode === 404 || error.message.endsWith('(404)')

/**
 * Every changelog row, newest first, a page at a time until the last page or
 * more than 500 rows. "More pages" is "the page came back full", counted
 * before rows this block doesn't know were skipped. A 404 is an answer, not a
 * failure: the server has no changelog.
 */
const fetchChangeLog = async (
    engine: DataEngine,
    resource: string,
    params: Record<string, string>,
    signal?: AbortSignal
): Promise<ChangeLogResult> => {
    const rows: ChangeLogRow[] = []
    try {
        for (let page = 1; ; page++) {
            const { changeLog } = await engine.query(
                {
                    changeLog: {
                        resource,
                        params: {
                            ...params,
                            order: 'createdAt:desc',
                            page,
                            pageSize: CHANGELOG_PAGE_SIZE,
                        },
                    },
                },
                { signal }
            )
            const answer = ChangeLogPageSchema.parse(changeLog)
            rows.push(...answer.rows)
            // More than the most read: some were left out. Exactly that many
            // on full pages asks once more, to tell "no more" from "more".
            if (rows.length > CHANGELOG_MAX_ROWS) {
                return {
                    rows: rows.slice(0, CHANGELOG_MAX_ROWS),
                    truncated: true,
                    unsupported: false,
                }
            }
            if (answer.received < CHANGELOG_PAGE_SIZE) {
                return { rows, truncated: false, unsupported: false }
            }
        }
    } catch (error) {
        if (error instanceof FetchError && isNotFound(error)) {
            return { rows: [], truncated: false, unsupported: true }
        }
        throw error
    }
}

/**
 * Attribute value changes in one program, newest first. Without `program`
 * only the type's attributes come back, so a person's history asks once per
 * program and drops the rows the answers share.
 */
export const fetchAttributeChangeLog = (
    engine: DataEngine,
    { trackedEntity, program }: { trackedEntity: string; program: string },
    signal?: AbortSignal
): Promise<ChangeLogResult> =>
    fetchChangeLog(
        engine,
        `tracker/trackedEntities/${trackedEntity}/changeLogs`,
        { program },
        signal
    )

/** Data value changes (and, from 2.42, event field changes), newest first. */
export const fetchEventChangeLog = (
    engine: DataEngine,
    { event }: { event: string },
    signal?: AbortSignal
): Promise<ChangeLogResult> =>
    fetchChangeLog(engine, `tracker/events/${event}/changeLogs`, {}, signal)

export const fetchProgramTimelineMetadata = async (
    engine: DataEngine,
    { program }: { program: string },
    signal?: AbortSignal
): Promise<ProgramTimelineMetadata> => {
    const { metadata } = await engine.query(
        {
            metadata: {
                resource: 'programs',
                id: program,
                params: { fields: PROGRAM_FIELDS },
            },
        },
        { signal }
    )
    return ProgramTimelineMetadataSchema.parse(metadata)
}

/** Names for all ids in one request. */
export const fetchOrgUnitNames = async (
    engine: DataEngine,
    { ids }: { ids: ReadonlyArray<string> },
    signal?: AbortSignal
): Promise<OrgUnitName[]> => {
    // An empty `id:in:[]` filter is not guaranteed to match nothing.
    if (ids.length === 0) {
        return []
    }
    const { names } = await engine.query(
        {
            names: {
                resource: 'organisationUnits',
                params: {
                    filter: `id:in:[${ids.join(',')}]`,
                    fields: 'id,displayName',
                    paging: false,
                },
            },
        },
        { signal }
    )
    return OrgUnitNamesSchema.parse(names)
}
