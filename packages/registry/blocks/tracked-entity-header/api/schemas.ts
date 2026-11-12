import { z } from 'zod'
import type { AttributeMeta, AttributeMetadata } from './types'

const text = z.string().optional().catch(undefined)

const AttributeValueSchema = z.object({
    attribute: z.string().min(1),
    value: z.string(),
})

const EnrollmentSchema = z.looseObject({
    enrollment: z.string().min(1),
    program: z.string(),
    status: z.string(),
    enrolledAt: text,
    occurredAt: text,
    completedAt: text,
})

/** Entries that cannot be read are dropped one by one, so one odd value never fails the record. */
export const entries = <T>(schema: z.ZodType<T>) =>
    z
        .array(z.unknown())
        .catch([])
        .transform((list) =>
            list.flatMap((entry) => {
                const parsed = schema.safeParse(entry)
                return parsed.success ? [parsed.data] : []
            })
        )

/** `tracker/trackedEntities/{id}`: the tracked entity as received; the query narrows it to one program. */
export const TrackedEntityResponseSchema = z.looseObject({
    trackedEntity: z.string().min(1),
    trackedEntityType: z.string().min(1),
    inactive: z.boolean().catch(false),
    potentialDuplicate: z.boolean().catch(false),
    attributes: entries(AttributeValueSchema),
    enrollments: entries(EnrollmentSchema),
    programOwners: entries(
        z.object({ program: z.string(), orgUnit: z.string() })
    ),
})

const AttributeSchema = z.looseObject({
    id: z.string().min(1),
    displayFormName: z.string().min(1),
    valueType: z.string().min(1),
    // Never dropped when malformed: the part would show raw option codes.
    optionSet: z
        .object({
            options: z.array(
                z.object({ code: z.string(), displayName: z.string() })
            ),
        })
        .nullish()
        .transform((set) => set ?? undefined),
})

const AttributeRefSchema = z.looseObject({
    id: z.string().min(1),
    displayFormName: text,
})

/** One entry of `programTrackedEntityAttributes` or `trackedEntityTypeAttributes`. */
const ListedAttributeSchema = z.looseObject({
    trackedEntityAttribute: AttributeRefSchema,
    displayInList: z.boolean().catch(false),
    sortOrder: z.number().optional().catch(undefined),
})

type Listed = z.output<typeof ListedAttributeSchema>

const toMetadata = (
    typeName: string,
    listed: unknown[],
    extra: Partial<AttributeMetadata>
): AttributeMetadata => {
    const attributes = new Map<string, AttributeMeta>()
    const invalid: AttributeMetadata['invalid'] = new Map()
    const inList: { id: string; sortOrder: number }[] = []
    listed.forEach((entry, index) => {
        const ref = ListedAttributeSchema.safeParse(entry)
        if (!ref.success) {
            return
        }
        const { trackedEntityAttribute: raw, displayInList }: Listed = ref.data
        // A type's list has no sortOrder: its own order stands.
        const sortOrder = ref.data.sortOrder ?? index
        const parsed = AttributeSchema.safeParse(raw)
        if (parsed.success) {
            const { id, displayFormName, valueType, optionSet } = parsed.data
            attributes.set(id, {
                id,
                label: displayFormName,
                valueType,
                ...(optionSet && { optionSet }),
                displayInList,
                sortOrder,
            })
        } else {
            invalid.set(raw.id, {
                sortOrder,
                label: raw.displayFormName,
                error: new Error(
                    `Attribute ${raw.id} has metadata this block can't read: ${z.prettifyError(parsed.error)}`
                ),
            })
        }
        if (displayInList) {
            inList.push({ id: raw.id, sortOrder })
        }
    })
    return {
        typeName,
        attributes,
        invalid,
        listOrder: inList
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(({ id }) => id),
        ...extra,
    }
}

/** `programs/{id}` with the attribute fields of §6. */
export const ProgramAttributesResponseSchema = z
    .looseObject({
        displayName: text,
        incidentDateLabel: text,
        enrollmentDateLabel: text,
        trackedEntityType: z
            .looseObject({ displayName: z.string() })
            .optional()
            .catch(undefined),
        programTrackedEntityAttributes: z.array(z.unknown()),
    })
    .transform((program): AttributeMetadata =>
        toMetadata(
            program.trackedEntityType?.displayName ?? '',
            program.programTrackedEntityAttributes,
            {
                ...(program.displayName !== undefined && {
                    programName: program.displayName,
                }),
                ...(program.incidentDateLabel !== undefined && {
                    incidentDateLabel: program.incidentDateLabel,
                }),
                ...(program.enrollmentDateLabel !== undefined && {
                    enrollmentDateLabel: program.enrollmentDateLabel,
                }),
            }
        )
    )

/** `trackedEntityTypes/{id}`: the same attributes without a program. */
export const TypeAttributesResponseSchema = z
    .looseObject({
        displayName: z.string(),
        trackedEntityTypeAttributes: z.array(z.unknown()),
    })
    .transform((type): AttributeMetadata =>
        toMetadata(type.displayName, type.trackedEntityTypeAttributes, {})
    )

export const OrgUnitResponseSchema = z
    .looseObject({ displayName: z.string() })
    .transform(({ displayName }) => displayName)
