import { z } from 'zod'
import type {
    PatientListEnrollment,
    PatientListEnrollmentStatus,
    PatientListPage,
    PatientListQuery,
    PatientListRow,
} from '../types'

/** `.catch` makes every field lenient: a malformed one loses only itself. */
const lenient = <T extends z.ZodType>(schema: T) =>
    schema.optional().catch(undefined)

const ENROLLMENT_STATUSES = [
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
] as const satisfies readonly PatientListEnrollmentStatus[]

const AttributeValueSchema = z.looseObject({
    attribute: lenient(z.string()),
    value: lenient(z.union([z.string(), z.number(), z.boolean()])),
})

const EnrollmentSchema = z.looseObject({
    enrollment: lenient(z.string()),
    program: lenient(z.string()),
    status: lenient(z.enum(ENROLLMENT_STATUSES)),
    enrolledAt: lenient(z.string()),
    occurredAt: lenient(z.string()),
    orgUnit: lenient(z.string()),
})

const TrackedEntitySchema = z.looseObject({
    trackedEntity: lenient(z.string()),
    orgUnit: lenient(z.string()),
    createdAt: lenient(z.string()),
    updatedAt: lenient(z.string()),
    inactive: lenient(z.boolean()),
    attributes: lenient(z.array(lenient(AttributeValueSchema))),
    enrollments: lenient(z.array(lenient(EnrollmentSchema))),
})

const TrackedEntityListSchema = lenient(z.array(lenient(TrackedEntitySchema)))

/**
 * A `tracker/trackedEntities` response: the list under `trackedEntities`
 * (2.42+) or `instances` (2.41), the pager under `pager` (2.42+) or at the top
 * level (2.41).
 */
export const PatientListResponseSchema = z.looseObject({
    trackedEntities: TrackedEntityListSchema,
    instances: TrackedEntityListSchema,
    pager: lenient(
        z.looseObject({
            page: lenient(z.number()),
            pageSize: lenient(z.number()),
            nextPage: lenient(z.string()),
        })
    ),
    page: lenient(z.number()),
    pageSize: lenient(z.number()),
})

type PatientListResponse = z.infer<typeof PatientListResponseSchema>
type TrackedEntity = NonNullable<
    NonNullable<PatientListResponse['trackedEntities']>[number]
>

const toAttributes = (entries: TrackedEntity['attributes']) => {
    const attributes: Record<string, string> = {}
    for (const entry of entries ?? []) {
        if (entry?.attribute === undefined || entry.value === undefined) {
            continue
        }
        attributes[entry.attribute] = String(entry.value)
    }
    return attributes
}

const toEnrollment = (
    enrollments: TrackedEntity['enrollments'],
    program: string
): PatientListEnrollment | undefined => {
    for (const enrollment of enrollments ?? []) {
        if (
            enrollment?.program !== program ||
            enrollment.enrollment === undefined ||
            enrollment.status === undefined
        ) {
            continue
        }
        return {
            enrollment: enrollment.enrollment,
            status: enrollment.status,
            enrolledAt: enrollment.enrolledAt,
            occurredAt: enrollment.occurredAt,
            orgUnit: enrollment.orgUnit,
        }
    }
    return undefined
}

const toRow = (
    entity: TrackedEntity,
    trackedEntity: string,
    program: string
): PatientListRow => ({
    trackedEntity,
    orgUnit: entity.orgUnit,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    inactive: entity.inactive ?? false,
    attributes: toAttributes(entity.attributes),
    enrollment: toEnrollment(entity.enrollments, program),
})

/** One page of rows; tracked entities without an id are left out. */
export const toPatientListPage = (
    response: PatientListResponse,
    query: PatientListQuery,
    apiVersion: number
): PatientListPage => {
    const entities = response.trackedEntities ?? response.instances ?? []
    const rows: PatientListRow[] = []
    for (const entity of entities) {
        if (entity?.trackedEntity === undefined) continue
        rows.push(toRow(entity, entity.trackedEntity, query.program))
    }
    return {
        rows,
        // 2.41 has no next-page link: a full page may have a next one. The
        // server's count, so a dropped malformed entity does not end the list.
        hasNextPage:
            apiVersion >= 42
                ? Boolean(response.pager?.nextPage)
                : entities.length === query.pageSize,
    }
}
