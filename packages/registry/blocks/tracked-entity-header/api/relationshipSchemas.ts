import { z } from 'zod'
import { entries } from './schemas'
import type { AttributeMeta, LinkedEnd, RelationshipTypeMeta } from './types'

const text = z.string().optional().catch(undefined)

const LinkedTrackedEntitySchema = z.looseObject({
    trackedEntity: z.string().min(1),
    trackedEntityType: z.string().min(1),

    attributes: z
        .array(z.unknown())
        .pipe(
            entries(
                z.object({ attribute: z.string().min(1), value: z.string() })
            )
        ),
})

const lenient = <T extends z.ZodType>(schema: T) =>
    schema.optional().catch(undefined)

interface ParsedEnd {
    entityId?: string
    linked: LinkedEnd
}

const EndSchema = z
    .looseObject({
        trackedEntity: lenient(
            z.looseObject({ trackedEntity: z.string().min(1) })
        ),
        enrollment: lenient(z.looseObject({ enrollment: z.string() })),
        event: lenient(z.looseObject({ event: z.string() })),
    })
    .transform<ParsedEnd>((end) => {
        const entityId = end.trackedEntity?.trackedEntity
        const entity = LinkedTrackedEntitySchema.safeParse(end.trackedEntity)
        if (entity.success) {
            const {
                trackedEntity: id,
                trackedEntityType,
                attributes,
            } = entity.data
            return {
                ...(entityId !== undefined && { entityId }),
                linked: {
                    kind: 'trackedEntity',
                    id,
                    type: trackedEntityType,
                    values: new Map(
                        attributes.map((a) => [a.attribute, a.value])
                    ),
                },
            }
        }
        const linked: LinkedEnd = (() => {
            if (end.enrollment) {
                return {
                    kind: 'enrollment',
                    id: end.enrollment.enrollment,
                } satisfies LinkedEnd
            }
            if (end.event) {
                return {
                    kind: 'event',
                    id: end.event.event,
                } satisfies LinkedEnd
            }
            return { kind: 'unreadable' } satisfies LinkedEnd
        })()
        return { ...(entityId !== undefined && { entityId }), linked }
    })

const RelationshipSchema = z.looseObject({
    relationship: z.string().min(1),
    relationshipType: z.string().min(1),
    relationshipName: text,
    from: EndSchema,
    to: EndSchema,
})

/** `tracker/relationships`: one malformed relationship is dropped, the rest kept. */
export const RelationshipsResponseSchema = z
    .looseObject({ relationships: entries(RelationshipSchema) })
    .transform(({ relationships }) => relationships)

const ConstraintSchema = z
    .looseObject({
        trackedEntityType: z
            .looseObject({ displayName: z.string() })
            .optional()
            .catch(undefined),
        trackerDataView: z
            .looseObject({ attributes: z.array(z.string()).catch([]) })
            .optional()
            .catch(undefined),
    })
    .transform((constraint) => ({
        ...(constraint.trackedEntityType && {
            typeName: constraint.trackedEntityType.displayName,
        }),
        view: constraint.trackerDataView?.attributes ?? [],
    }))

const RelationshipTypeSchema = z
    .looseObject({
        id: z.string().min(1),
        displayName: z.string(),
        fromToName: text,
        toFromName: text,
        bidirectional: z.boolean().catch(false),
        fromConstraint: ConstraintSchema,
        toConstraint: ConstraintSchema,
    })
    .transform<RelationshipTypeMeta>((type) => ({
        id: type.id,
        name: type.displayName,
        ...(type.fromToName !== undefined && {
            fromToName: type.fromToName,
        }),
        ...(type.toFromName !== undefined && {
            toFromName: type.toFromName,
        }),
        bidirectional: type.bidirectional,
        ends: { from: type.fromConstraint, to: type.toConstraint },
    }))

export const RelationshipTypesResponseSchema = z
    .looseObject({ relationshipTypes: entries(RelationshipTypeSchema) })
    .transform(
        ({ relationshipTypes }) =>
            new Map(relationshipTypes.map((type) => [type.id, type]))
    )

const ViewAttributeSchema = z
    .looseObject({
        id: z.string().min(1),
        displayFormName: z.string().min(1),
        valueType: z.string().min(1),
        optionSet: z
            .object({
                options: z.array(
                    z.object({ code: z.string(), displayName: z.string() })
                ),
            })
            .nullish()
            .transform((set) => set ?? undefined),
    })
    .transform<AttributeMeta>(
        ({ id, displayFormName, valueType, optionSet }) => ({
            id,
            label: displayFormName,
            valueType,
            ...(optionSet && { optionSet }),
            displayInList: false,
            sortOrder: 0,
        })
    )

export const ViewAttributesResponseSchema = z
    .looseObject({ trackedEntityAttributes: entries(ViewAttributeSchema) })
    .transform(
        ({ trackedEntityAttributes }) =>
            new Map(trackedEntityAttributes.map((a) => [a.id, a]))
    )
