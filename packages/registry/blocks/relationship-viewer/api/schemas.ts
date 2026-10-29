import { z } from 'zod'
import type { ConstraintMeta, RelationshipMetadata } from '../domain/labels'
import type {
    NodeRecord,
    NodeRef,
    RecordEnrollment,
    RelationshipLink,
} from '../domain/model'

const AttributesSchema = z
    .array(
        z.object({
            attribute: z.string(),
            displayName: z.string().nullish(),
            value: z.string(),
        })
    )
    .nullish()
    .transform((attributes) =>
        (attributes ?? []).map((a) => ({
            attribute: a.attribute,
            displayName: a.displayName ?? undefined,
            value: a.value,
        }))
    )

const DataValuesSchema = z
    .array(z.object({ dataElement: z.string(), value: z.string() }))
    .nullish()
    .transform((dataValues) => dataValues ?? [])

// A relationship item holds one of the three; anything else resolves to none.
const ItemSchema = z
    .object({
        trackedEntity: z.object({ trackedEntity: z.string() }).nullish(),
        enrollment: z.object({ enrollment: z.string() }).nullish(),
        event: z.object({ event: z.string() }).nullish(),
    })
    .nullish()
    .transform((item): NodeRef | undefined => {
        if (item?.trackedEntity) {
            return {
                kind: 'trackedEntity',
                id: item.trackedEntity.trackedEntity,
            }
        }
        if (item?.enrollment) {
            return { kind: 'enrollment', id: item.enrollment.enrollment }
        }
        if (item?.event) {
            return { kind: 'event', id: item.event.event }
        }
        return undefined
    })

const RelationshipSchema = z
    .object({
        relationship: z.string(),
        relationshipType: z.string(),
        bidirectional: z.boolean().nullish(),
        createdAt: z.string().nullish(),
        from: ItemSchema,
        to: ItemSchema,
    })
    .transform((r): RelationshipLink | undefined =>
        r.from && r.to
            ? {
                  relationship: r.relationship,
                  relationshipType: r.relationshipType,
                  bidirectional: r.bidirectional ?? false,
                  createdAt: r.createdAt ?? undefined,
                  from: r.from,
                  to: r.to,
              }
            : undefined
    )

// A relationship with an unresolvable side cannot be drawn; it is counted instead.
export const RelationshipListSchema = z
    .object({ relationships: z.array(RelationshipSchema).nullish() })
    .transform(({ relationships }) => {
        const all = relationships ?? []
        const resolved = all.flatMap((r) => r ?? [])
        return {
            relationships: resolved,
            unresolvedLinkCount: all.length - resolved.length,
        }
    })

// Records carry no relationships; they come from tracker/relationships.
type RecordWithoutLinks = Omit<
    NodeRecord,
    'relationships' | 'unresolvedLinkCount'
>

const EnrollmentBase = z.object({
    enrollment: z.string(),
    program: z.string(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
    followUp: z.boolean().nullish(),
    enrolledAt: z.string().nullish(),
    occurredAt: z.string().nullish(),
})

const toEnrollment = (e: z.infer<typeof EnrollmentBase>): RecordEnrollment => ({
    enrollment: e.enrollment,
    program: e.program,
    status: e.status,
    followUp: e.followUp ?? false,
    enrolledAt: e.enrolledAt ?? undefined,
    occurredAt: e.occurredAt ?? undefined,
})

export const TrackedEntityRecordSchema = z
    .object({
        trackedEntity: z.string(),
        trackedEntityType: z.string().nullish(),
        attributes: AttributesSchema,
        enrollments: z
            .array(EnrollmentBase.transform(toEnrollment))
            .nullish()
            .transform((enrollments) => enrollments ?? []),
    })
    .transform((te): RecordWithoutLinks => ({
        ref: { kind: 'trackedEntity', id: te.trackedEntity },
        trackedEntityType: te.trackedEntityType ?? undefined,
        attributes: te.attributes,
        dataValues: [],
        enrollments: te.enrollments,
    }))

export const EnrollmentRecordSchema = EnrollmentBase.extend({
    attributes: AttributesSchema,
}).transform((e): RecordWithoutLinks => ({
    ref: { kind: 'enrollment', id: e.enrollment },
    attributes: e.attributes,
    dataValues: [],
    enrollments: [toEnrollment(e)],
}))

export const EventRecordSchema = z
    .object({
        event: z.string(),
        program: z.string().nullish(),
        programStage: z.string().nullish(),
        occurredAt: z.string().nullish(),
        dataValues: DataValuesSchema,
    })
    .transform((e): RecordWithoutLinks => ({
        ref: { kind: 'event', id: e.event },
        program: e.program ?? undefined,
        programStage: e.programStage ?? undefined,
        occurredAt: e.occurredAt ?? undefined,
        attributes: [],
        dataValues: e.dataValues,
        enrollments: [],
    }))

export const SeedPageSchema = z.object({
    trackedEntities: z.array(
        z.object({ trackedEntity: z.string() }).transform((te): NodeRef => ({
            kind: 'trackedEntity',
            id: te.trackedEntity,
        }))
    ),
})

// Depending on the DHIS2 version the view lists UIDs or `{ id }` references.
const UidsSchema = z
    .array(
        z.union([
            z.string(),
            z.object({ id: z.string() }).transform((r) => r.id),
        ])
    )
    .nullish()
    .transform((uids) => uids ?? [])

const ConstraintSchema = z
    .object({
        relationshipEntity: z.enum([
            'TRACKED_ENTITY_INSTANCE',
            'PROGRAM_INSTANCE',
            'PROGRAM_STAGE_INSTANCE',
        ]),
        trackerDataView: z
            .object({ attributes: UidsSchema, dataElements: UidsSchema })
            .nullish(),
    })
    .transform((c): ConstraintMeta => ({
        relationshipEntity: c.relationshipEntity,
        trackerDataView: {
            attributes: c.trackerDataView?.attributes ?? [],
            dataElements: c.trackerDataView?.dataElements ?? [],
        },
    }))

export const MetadataSchema = z
    .object({
        relationshipTypes: z.object({
            relationshipTypes: z.array(
                z.object({
                    id: z.string(),
                    displayName: z.string(),
                    bidirectional: z.boolean().nullish(),
                    fromToName: z.string().nullish(),
                    toFromName: z.string().nullish(),
                    fromConstraint: ConstraintSchema,
                    toConstraint: ConstraintSchema,
                })
            ),
        }),
        trackedEntityTypes: z.object({
            trackedEntityTypes: z.array(
                z.object({
                    id: z.string(),
                    trackedEntityTypeAttributes: z
                        .array(
                            z.object({
                                displayInList: z.boolean().nullish(),
                                trackedEntityAttribute: z.object({
                                    id: z.string(),
                                }),
                            })
                        )
                        .nullish(),
                })
            ),
        }),
    })
    .transform((m): RelationshipMetadata => ({
        types: new Map(
            m.relationshipTypes.relationshipTypes.map((t) => [
                t.id,
                {
                    id: t.id,
                    displayName: t.displayName,
                    bidirectional: t.bidirectional ?? false,
                    fromToName: t.fromToName ?? undefined,
                    toFromName: t.toFromName ?? undefined,
                    from: t.fromConstraint,
                    to: t.toConstraint,
                },
            ])
        ),
        trackedEntityTypeDisplayAttributes: new Map(
            m.trackedEntityTypes.trackedEntityTypes.map((t) => [
                t.id,
                (t.trackedEntityTypeAttributes ?? [])
                    .filter((a) => a.displayInList)
                    .map((a) => a.trackedEntityAttribute.id),
            ])
        ),
    }))
