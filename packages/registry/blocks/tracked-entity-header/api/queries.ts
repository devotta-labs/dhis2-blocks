import type { Result } from 'better-result'
import type { TrackedEntityHeaderResourceClient } from './client'
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

const TRACKED_ENTITY_FIELDS =
    'trackedEntity,trackedEntityType,orgUnit,inactive,potentialDuplicate,attributes[attribute,displayName,valueType,value],enrollments[enrollment,program,status,orgUnit,enrolledAt,occurredAt,followUp,completedAt],programOwners[orgUnit,program]'

const ATTRIBUTE_FIELDS =
    'trackedEntityAttribute[id,displayFormName,valueType,optionSet[options[code,displayName]]]'

const PROGRAM_FIELDS = `displayName,accessLevel,incidentDateLabel,enrollmentDateLabel,trackedEntityType[displayName],programTrackedEntityAttributes[displayInList,sortOrder,${ATTRIBUTE_FIELDS}]`

const TYPE_FIELDS = `displayName,trackedEntityTypeAttributes[displayInList,${ATTRIBUTE_FIELDS}]`

/**
 * A person re-enrolled after completing has several enrollments in the program:
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

/** One person, with the enrollment and owner of `program` only. Without a program, neither. */
export const fetchTrackedEntity = async (
    client: TrackedEntityHeaderResourceClient,
    { trackedEntity, program }: { trackedEntity: string; program?: string },
    signal?: AbortSignal
): Promise<Result<TrackedEntityRecord, Error>> => {
    const result = await client.query(
        {
            resource: 'tracker/trackedEntities',
            id: trackedEntity,
            params: {
                ...(program !== undefined && { program }),
                fields: TRACKED_ENTITY_FIELDS,
            },
        },
        TrackedEntityResponseSchema,
        signal
    )
    return result.map((person) => {
        const enrollment =
            program === undefined
                ? undefined
                : pickEnrollment(
                      person.enrollments.filter((e) => e.program === program)
                  )
        const ownerOrgUnit =
            program === undefined
                ? undefined
                : person.programOwners.find((o) => o.program === program)
                      ?.orgUnit
        return {
            id: person.trackedEntity,
            type: person.trackedEntityType,
            inactive: person.inactive,
            potentialDuplicate: person.potentialDuplicate,
            values: new Map(
                person.attributes.map((a) => [a.attribute, a.value])
            ),
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
    })
}

/** The program's attributes, or the person type's when there is no program. */
export const fetchAttributeMetadata = (
    client: TrackedEntityHeaderResourceClient,
    subject: { program: string } | { trackedEntityType: string },
    signal?: AbortSignal
): Promise<Result<AttributeMetadata, Error>> =>
    'program' in subject
        ? client.query(
              {
                  resource: 'programs',
                  id: subject.program,
                  params: { fields: PROGRAM_FIELDS },
              },
              ProgramAttributesResponseSchema,
              signal
          )
        : client.query(
              {
                  resource: 'trackedEntityTypes',
                  id: subject.trackedEntityType,
                  params: { fields: TYPE_FIELDS },
              },
              TypeAttributesResponseSchema,
              signal
          )

export const fetchOrgUnitName = (
    client: TrackedEntityHeaderResourceClient,
    id: string,
    signal?: AbortSignal
): Promise<Result<string, Error>> =>
    client.query(
        {
            resource: 'organisationUnits',
            id,
            params: { fields: 'displayName' },
        },
        OrgUnitResponseSchema,
        signal
    )
