import { FetchError, useDataEngine } from '@dhis2/app-runtime'
import { skipToken, useQuery } from '@tanstack/react-query'
import {
    OrgUnitResponseSchema,
    ProgramAttributesResponseSchema,
    TrackedEntityResponseSchema,
    TypeAttributesResponseSchema,
} from './schemas'
import type {
    AttributeMetadata,
    EnrollmentRecord,
    TrackedEntityRecord,
} from './types'

export type DataEngine = ReturnType<typeof useDataEngine>

const TRACKED_ENTITY_FIELDS =
    'trackedEntity,trackedEntityType,orgUnit,inactive,potentialDuplicate,attributes[attribute,displayName,valueType,value],enrollments[enrollment,program,status,orgUnit,enrolledAt,occurredAt,followUp,completedAt],programOwners[orgUnit,program]'

const ATTRIBUTE_FIELDS =
    'trackedEntityAttribute[id,displayFormName,valueType,optionSet[options[code,displayName]]]'

const PROGRAM_FIELDS = `displayName,accessLevel,incidentDateLabel,enrollmentDateLabel,trackedEntityType[displayName],programTrackedEntityAttributes[displayInList,sortOrder,${ATTRIBUTE_FIELDS}]`

const TYPE_FIELDS = `displayName,trackedEntityTypeAttributes[displayInList,${ATTRIBUTE_FIELDS}]`

/** Metadata and org unit names change rarely; a record is always asked for fresh. */
export const METADATA_STALE_TIME = 60 * 60_000

/** The server refused the request: 403 only. app-runtime also files 401 and 409 under `access`. */
export const isForbidden = (error: Error) =>
    error instanceof FetchError &&
    error.type === 'access' &&
    error.details.httpStatusCode === 403

export const isNotFound = (error: Error) =>
    error instanceof FetchError && error.details.httpStatusCode === 404

/**
 * Only a failed request is retried, twice, and only when the server or the
 * network failed. A malformed response and a client error would fail the
 * same way again.
 */
export const shouldRetryRequest = (failureCount: number, error: Error) =>
    failureCount < 2 &&
    error instanceof FetchError &&
    error.type !== 'access' &&
    (error.details.httpStatusCode === undefined ||
        error.details.httpStatusCode >= 500)

/**
 * A tracked entity re-enrolled after completing has several enrollments in the program:
 * the ACTIVE one stands, else the latest enrolledAt. ISO date-times in one
 * format order as text.
 */
const pickEnrollment = (
    enrollments: EnrollmentRecord[]
): EnrollmentRecord | undefined => {
    const active = enrollments.filter(({ status }) => status === 'ACTIVE')
    return (active.length > 0 ? active : enrollments).reduce<
        EnrollmentRecord | undefined
    >(
        (latest, next) =>
            latest === undefined ||
            (next.enrolledAt ?? '') > (latest.enrolledAt ?? '')
                ? next
                : latest,
        undefined
    )
}

interface TrackedEntitySubject {
    trackedEntity: string
    program?: string
}

const requestTrackedEntity = async (
    engine: DataEngine,
    { trackedEntity, program }: TrackedEntitySubject,
    signal: AbortSignal
) => {
    const { entity } = await engine.query(
        {
            entity: {
                resource: 'tracker/trackedEntities',
                id: trackedEntity,
                params: {
                    ...(program !== undefined && { program }),
                    fields: TRACKED_ENTITY_FIELDS,
                },
            },
        },
        { signal }
    )
    return TrackedEntityResponseSchema.parse(entity)
}

/** One tracked entity, with the enrollment and owner of `program` only. Without a program, or not enrolled in it, neither. */
const fetchTrackedEntity = async (
    engine: DataEngine,
    { trackedEntity, program }: TrackedEntitySubject,
    signal: AbortSignal
): Promise<TrackedEntityRecord> => {
    let enrolledIn = program
    const entity = await requestTrackedEntity(
        engine,
        { trackedEntity, program },
        signal
    ).catch((error: Error) => {
        // DHIS2 answers 404 for a tracked entity not enrolled in the program; it is still there without it.
        if (program === undefined || !isNotFound(error)) {
            throw error
        }
        enrolledIn = undefined
        return requestTrackedEntity(engine, { trackedEntity }, signal)
    })
    const enrollment =
        enrolledIn === undefined
            ? undefined
            : pickEnrollment(
                  entity.enrollments.filter((e) => e.program === enrolledIn)
              )
    const ownerOrgUnit =
        enrolledIn === undefined
            ? undefined
            : entity.programOwners.find((o) => o.program === enrolledIn)
                  ?.orgUnit
    return {
        id: entity.trackedEntity,
        type: entity.trackedEntityType,
        inactive: entity.inactive,
        potentialDuplicate: entity.potentialDuplicate,
        values: new Map(entity.attributes.map((a) => [a.attribute, a.value])),
        ...(enrollment && {
            enrollment: {
                enrollment: enrollment.enrollment,
                status: enrollment.status,
                enrolledAt: enrollment.enrolledAt,
                occurredAt: enrollment.occurredAt,
                completedAt: enrollment.completedAt,
            },
        }),
        ...(ownerOrgUnit !== undefined && { ownerOrgUnit }),
    }
}

/** The program whose attributes show, or the tracked entity type when there is no program. */
export type AttributeSubject =
    | { program: string }
    | { trackedEntityType: string }

const fetchAttributeMetadata = async (
    engine: DataEngine,
    subject: AttributeSubject,
    signal: AbortSignal
): Promise<AttributeMetadata> => {
    if ('program' in subject) {
        const { program } = await engine.query(
            {
                program: {
                    resource: 'programs',
                    id: subject.program,
                    params: { fields: PROGRAM_FIELDS },
                },
            },
            { signal }
        )
        return ProgramAttributesResponseSchema.parse(program)
    }
    const { type } = await engine.query(
        {
            type: {
                resource: 'trackedEntityTypes',
                id: subject.trackedEntityType,
                params: { fields: TYPE_FIELDS },
            },
        },
        { signal }
    )
    return TypeAttributesResponseSchema.parse(type)
}

const fetchOrgUnitName = async (
    engine: DataEngine,
    id: string,
    signal: AbortSignal
): Promise<string> => {
    const { orgUnit } = await engine.query(
        {
            orgUnit: {
                resource: 'organisationUnits',
                id,
                params: { fields: 'displayName' },
            },
        },
        { signal }
    )
    return OrgUnitResponseSchema.parse(orgUnit)
}

/**
 * One tracked entity. Nothing is asked for without an id.
 *
 * Every part that shows the record calls this, and they mount at different
 * times: a banner mounts its parts once the record is there, and again, hidden,
 * when it is refused. Only the first asks; one that joins later neither asks
 * again nor retries a refused request. Nothing is kept once no part shows the
 * record, so the next visit asks for it fresh.
 */
export const useTrackedEntity = ({
    trackedEntity,
    program,
}: TrackedEntitySubject) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: [
            'tracked-entity-header',
            'trackedEntity',
            trackedEntity,
            program ?? '',
        ],
        queryFn: ({ signal }) =>
            fetchTrackedEntity(engine, { trackedEntity, program }, signal),
        enabled: trackedEntity !== '',
        retry: shouldRetryRequest,
        refetchOnMount: false,
        retryOnMount: false,
        gcTime: 0,
    })
}

/**
 * The attributes of a program or a tracked entity type. Waits while the subject
 * is not known yet. Like the record, a part that mounts after a refusal does
 * not ask again.
 */
export const useAttributeMetadata = (subject: AttributeSubject | undefined) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: [
            'tracked-entity-header',
            'attributeMetadata',
            subject ?? null,
        ],
        queryFn:
            subject === undefined
                ? skipToken
                : ({ signal }) =>
                      fetchAttributeMetadata(engine, subject, signal),
        retry: shouldRetryRequest,
        retryOnMount: false,
        staleTime: METADATA_STALE_TIME,
    })
}

export const useOrgUnitName = (id: string | undefined) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: ['tracked-entity-header', 'orgUnit', id ?? null],
        queryFn:
            id === undefined
                ? skipToken
                : ({ signal }) => fetchOrgUnitName(engine, id, signal),
        retry: shouldRetryRequest,
        staleTime: METADATA_STALE_TIME,
    })
}
