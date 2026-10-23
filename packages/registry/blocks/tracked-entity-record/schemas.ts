import { z } from 'zod'

// Response schemas for the requests in requests.ts (spec 8.2). Objects are
// loose, so a field the server adds never breaks the block. What the block
// reads is required; what the API leaves out is optional or defaulted, and
// both `null` and an absent key are accepted where versions differ (spec 15).

/** A boolean the API omits when false. */
const flag = z
    .boolean()
    .nullish()
    .transform((value) => value ?? false)

const optionalText = z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)

const optionalNumber = z
    .number()
    .nullish()
    .transform((value) => value ?? undefined)

const AccessSchema = z.looseObject({
    data: z.looseObject({ read: z.boolean(), write: z.boolean() }),
})

const AttributeValueSchema = z.looseObject({
    attribute: z.string(),
    value: z.string().optional(),
})

const NoteSchema = z.looseObject({
    note: z.string(),
    value: optionalText,
    storedAt: optionalText,
    storedBy: optionalText,
    createdBy: z
        .looseObject({
            uid: optionalText,
            username: optionalText,
            displayName: optionalText,
        })
        .nullish()
        .transform((value) => value ?? undefined),
})

/** An empty data value comes back as `{ dataElement }`, with no `value` key. */
const DataValueSchema = z.looseObject({
    dataElement: z.string(),
    value: z.string().optional(),
})

const EventSchema = z.looseObject({
    event: z.string(),
    program: z.string(),
    programStage: z.string(),
    enrollment: z.string(),
    status: z.string(),
    occurredAt: optionalText,
    scheduledAt: optionalText,
    completedAt: optionalText,
    createdAt: z.string(),
    updatedAt: z.string(),
    orgUnit: z.string(),
    geometry: z
        .record(z.string(), z.json())
        .nullish()
        .transform((value) => value ?? undefined),
    dataValues: z.array(DataValueSchema).default([]),
    notes: z.array(NoteSchema).default([]),
})

const EnrollmentSchema = z.looseObject({
    enrollment: z.string(),
    program: z.string(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
    orgUnit: z.string(),
    enrolledAt: z.string(),
    occurredAt: optionalText,
    completedAt: optionalText,
    followUp: flag,
    createdAt: z.string(),
    updatedAt: z.string(),
    attributes: z.array(AttributeValueSchema).default([]),
    notes: z.array(NoteSchema).default([]),
    events: z.array(EventSchema).default([]),
})

export const PersonResponseSchema = z.looseObject({
    trackedEntity: z.string(),
    trackedEntityType: z.string(),
    orgUnit: z.string(),
    inactive: flag,
    potentialDuplicate: flag,
    createdAt: z.string(),
    updatedAt: z.string(),
    attributes: z.array(AttributeValueSchema).default([]),
    // Required: without owner rows a hidden enrollment would read as "not
    // enrolled" (spec 7.3), so a missing key is an invalid response.
    programOwners: z.array(
        z.looseObject({ program: z.string(), orgUnit: z.string() })
    ),
    enrollments: z.array(EnrollmentSchema).default([]),
})
export type PersonResponse = z.infer<typeof PersonResponseSchema>

const OptionSetSchema = z.looseObject({
    id: z.string(),
    options: z
        .array(z.looseObject({ code: z.string(), displayName: z.string() }))
        .default([]),
})

const optionSet = OptionSetSchema.nullish().transform(
    (value) => value ?? undefined
)

const FieldMetadataSchema = z.looseObject({
    id: z.string(),
    displayName: z.string(),
    displayShortName: optionalText,
    displayFormName: optionalText,
    valueType: z.string(),
    optionSet,
})

const AttributeMetadataSchema = FieldMetadataSchema.extend({ unique: flag })

const StageDataElementSchema = z.looseObject({
    displayInReports: flag,
    sortOrder: z.number().default(0),
    dataElement: FieldMetadataSchema,
})

const StageSchema = z.looseObject({
    id: z.string(),
    displayName: z.string(),
    sortOrder: z.number().default(0),
    repeatable: flag,
    autoGenerateEvent: flag,
    openAfterEnrollment: flag,
    generatedByEnrollmentDate: flag,
    reportDateToUse: optionalText,
    minDaysFromStart: z.number().default(0),
    standardInterval: optionalNumber,
    hideDueDate: flag,
    blockEntryForm: flag,
    allowGenerateNextVisit: flag,
    executionDateLabel: optionalText,
    displayExecutionDateLabel: optionalText,
    dueDateLabel: optionalText,
    displayDueDateLabel: optionalText,
    access: AccessSchema,
    programStageDataElements: z.array(StageDataElementSchema).default([]),
})

const ProgramAttributeSchema = z.looseObject({
    displayInList: flag,
    mandatory: flag,
    sortOrder: z.number().default(0),
    trackedEntityAttribute: AttributeMetadataSchema,
})

const ProgramSchema = z.looseObject({
    id: z.string(),
    displayName: z.string(),
    programType: z.string(),
    accessLevel: z.enum(['OPEN', 'AUDITED', 'PROTECTED', 'CLOSED']),
    onlyEnrollOnce: flag,
    displayIncidentDate: flag,
    selectEnrollmentDatesInFuture: flag,
    selectIncidentDatesInFuture: flag,
    enrollmentDateLabel: optionalText,
    displayEnrollmentDateLabel: optionalText,
    incidentDateLabel: optionalText,
    displayIncidentDateLabel: optionalText,
    featureType: optionalText,
    completeEventsExpiryDays: z.number().default(0),
    expiryDays: z.number().default(0),
    expiryPeriodType: optionalText,
    access: AccessSchema,
    trackedEntityType: z
        .looseObject({ id: z.string() })
        .nullish()
        .transform((value) => value ?? undefined),
    programTrackedEntityAttributes: z.array(ProgramAttributeSchema).default([]),
    programStages: z.array(StageSchema).default([]),
})

export const ProgramsResponseSchema = z.looseObject({
    programs: z.array(ProgramSchema),
})
export type ProgramsResponse = z.infer<typeof ProgramsResponseSchema>

export const TrackedEntityTypeResponseSchema = z.looseObject({
    id: z.string(),
    displayName: z.string(),
    access: AccessSchema,
    trackedEntityTypeAttributes: z
        .array(
            z.looseObject({
                displayInList: flag,
                mandatory: flag,
                trackedEntityAttribute: AttributeMetadataSchema,
            })
        )
        .default([]),
})
export type TrackedEntityTypeResponse = z.infer<
    typeof TrackedEntityTypeResponseSchema
>

const RelationshipSideSchema = z.looseObject({
    trackedEntity: z
        .looseObject({
            trackedEntity: z.string(),
            attributes: z.array(AttributeValueSchema).default([]),
        })
        .nullish()
        .transform((value) => value ?? undefined),
    enrollment: z
        .looseObject({ enrollment: z.string() })
        .nullish()
        .transform((value) => value ?? undefined),
    event: z
        .looseObject({ event: z.string() })
        .nullish()
        .transform((value) => value ?? undefined),
})

export const RelationshipsResponseSchema = z.looseObject({
    relationships: z.array(
        z.looseObject({
            relationship: z.string(),
            relationshipType: z.string(),
            createdAt: optionalText,
            from: RelationshipSideSchema,
            to: RelationshipSideSchema,
        })
    ),
})
export type RelationshipsResponse = z.infer<typeof RelationshipsResponseSchema>

export const RelationshipTypesResponseSchema = z.looseObject({
    relationshipTypes: z.array(
        z.looseObject({
            id: z.string(),
            displayName: z.string(),
            fromToName: z.string(),
            toFromName: optionalText,
            bidirectional: flag,
        })
    ),
})
export type RelationshipTypesResponse = z.infer<
    typeof RelationshipTypesResponseSchema
>

export const UserScopesResponseSchema = z.looseObject({
    organisationUnits: z.array(z.looseObject({ id: z.string() })).default([]),
    teiSearchOrganisationUnits: z
        .array(z.looseObject({ id: z.string() }))
        .default([]),
})
export type UserScopesResponse = z.infer<typeof UserScopesResponseSchema>

export const OrgUnitPathsResponseSchema = z.looseObject({
    organisationUnits: z.array(
        z.looseObject({ id: z.string(), path: z.string() })
    ),
})
export type OrgUnitPathsResponse = z.infer<typeof OrgUnitPathsResponseSchema>
