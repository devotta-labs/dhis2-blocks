import { z, type ZodType } from 'zod'

// Shapes recorded from DHIS2 2.41, 2.42 and 2.43 in __fixtures__ (see its
// README). Dates and date-times are kept exactly as stored: the timeline
// places them by their stored day and never routes them through `Date`.

/** Absent and `null` both read as "not set". */
const optionalString = z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)

/** A list the server may leave out or send as `null`. */
const listOf = <T>(item: ZodType<T>) =>
    z
        .array(item)
        .nullish()
        .transform((items): T[] => items ?? [])

const flag = z
    .boolean()
    .nullish()
    .transform((value) => value ?? false)

/** The user snapshot on events, enrollments, notes and changelog rows. */
const UserSchema = z.object({
    uid: optionalString,
    username: z.string(),
    firstName: optionalString,
    surname: optionalString,
    displayName: optionalString,
})

export type TrackerUser = z.infer<typeof UserSchema>

const optionalUser = UserSchema.nullish().transform((user) => user ?? undefined)

const NoteSchema = z.object({
    note: z.string().min(1),
    value: z.string(),
    storedAt: optionalString,
    storedBy: optionalString,
    createdBy: optionalUser,
})

export type Note = z.infer<typeof NoteSchema>

const DataValueSchema = z.object({
    dataElement: z.string(),
    value: z.string().nullish(),
})

export const TrackerEventSchema = z.object({
    event: z.string().min(1),
    /** ACTIVE, COMPLETED, VISITED, SCHEDULE, SKIPPED or the legacy OVERDUE. */
    status: z.string(),
    program: optionalString,
    programStage: z.string(),
    enrollment: optionalString,
    trackedEntity: optionalString,
    orgUnit: optionalString,
    occurredAt: optionalString,
    scheduledAt: optionalString,
    completedAt: optionalString,
    /** A username only; no display name is sent for it on any version. */
    completedBy: optionalString,
    createdAt: optionalString,
    updatedAt: optionalString,
    createdBy: optionalUser,
    updatedBy: optionalUser,
    // A value without a value is skipped, so one bad entry cannot fail the
    // whole page.
    dataValues: listOf(DataValueSchema).transform((dataValues) =>
        dataValues.flatMap(({ dataElement, value }) =>
            value === null || value === undefined
                ? []
                : [{ dataElement, value }]
        )
    ),
    notes: listOf(NoteSchema),
})

export type TrackerEvent = z.infer<typeof TrackerEventSchema>

/** Every recorded version answers `events`; the legacy `instances` is still read. */
export const EventsPageSchema = z
    .object({
        events: z.array(TrackerEventSchema).optional(),
        instances: z.array(TrackerEventSchema).optional(),
    })
    .superRefine((value, context) => {
        if (!value.events && !value.instances) {
            context.addIssue({
                code: 'custom',
                message: 'Tracker response requires events or legacy instances',
            })
        }
    })
    .transform(
        (response): TrackerEvent[] =>
            response.events ?? response.instances ?? []
    )

export interface EventsPage {
    events: TrackerEvent[]
    /** The server may have more: the page came back full. */
    hasMore: boolean
    /**
     * Past stream only: the ordering time field of the last row the server
     * sent, kept or not. Everything newer than it has been read.
     */
    lastAt?: string
}

const EnrollmentSchema = z.object({
    enrollment: z.string().min(1),
    program: z.string(),
    /** ACTIVE, COMPLETED or CANCELLED. */
    status: z.string(),
    orgUnit: optionalString,
    enrolledAt: optionalString,
    occurredAt: optionalString,
    completedAt: optionalString,
    completedBy: optionalString,
    createdAt: optionalString,
    updatedAt: optionalString,
    createdBy: optionalUser,
    updatedBy: optionalUser,
    notes: listOf(NoteSchema),
})

export type Enrollment = z.infer<typeof EnrollmentSchema>

export const TrackedEntitySchema = z.object({
    trackedEntity: z.string().min(1),
    trackedEntityType: optionalString,
    orgUnit: optionalString,
    enrollments: listOf(EnrollmentSchema),
})

export type TrackedEntity = z.infer<typeof TrackedEntitySchema>

const ValueChangeSchema = {
    previousValue: optionalString,
    currentValue: optionalString,
}

const ChangeSchema = z.object({
    attributeValue: z
        .object({ attribute: z.string(), ...ValueChangeSchema })
        .optional(),
    dataValue: z
        .object({ dataElement: z.string(), ...ValueChangeSchema })
        .optional(),
    eventField: z
        .object({ field: z.string(), ...ValueChangeSchema })
        .optional(),
})

const CHANGE_TYPES = ['CREATE', 'UPDATE', 'DELETE'] as const

export type ChangeType = (typeof CHANGE_TYPES)[number]

export interface ChangeLogRow {
    createdAt: string
    createdBy: TrackerUser
    type: ChangeType
    change: {
        kind: 'attribute' | 'dataElement' | 'eventField'
        id: string
        previousValue?: string
        currentValue?: string
    }
}

const isChangeType = (type: string): type is ChangeType =>
    CHANGE_TYPES.some((known) => known === type)

const withValues = (
    kind: ChangeLogRow['change']['kind'],
    id: string,
    values: { previousValue?: string; currentValue?: string }
): ChangeLogRow['change'] => {
    const change: ChangeLogRow['change'] = { kind, id }
    if (values.previousValue !== undefined) {
        change.previousValue = values.previousValue
    }
    if (values.currentValue !== undefined) {
        change.currentValue = values.currentValue
    }
    return change
}

const ChangeLogRowSchema = z
    .object({
        createdAt: z.string(),
        createdBy: UserSchema,
        type: z.string(),
        change: ChangeSchema,
    })
    .transform((row): ChangeLogRow | undefined => {
        const { attributeValue, dataValue, eventField } = row.change
        const change = attributeValue
            ? withValues('attribute', attributeValue.attribute, attributeValue)
            : dataValue
              ? withValues('dataElement', dataValue.dataElement, dataValue)
              : eventField
                ? withValues('eventField', eventField.field, eventField)
                : undefined
        if (change === undefined || !isChangeType(row.type)) {
            return undefined
        }
        return {
            createdAt: row.createdAt,
            createdBy: row.createdBy,
            type: row.type,
            change,
        }
    })

/**
 * Tracked entity attribute and event changelog pages share this shape. A row
 * whose change or type this block does not know is skipped, not an error.
 */
export interface ParsedChangeLogPage {
    rows: ChangeLogRow[]
    /** Rows the server sent, skipped ones included. */
    received: number
}

export const ChangeLogPageSchema = z
    .object({ changeLogs: z.array(ChangeLogRowSchema) })
    .transform((page): ParsedChangeLogPage => ({
        rows: page.changeLogs.flatMap((row) => (row ? [row] : [])),
        received: page.changeLogs.length,
    }))

export interface ChangeLogPage {
    rows: ChangeLogRow[]
    /** The server may have more: the page came back full. */
    hasMore: boolean
}

const OptionSetSchema = z
    .object({
        options: z.array(
            z.object({ code: z.string(), displayName: z.string() })
        ),
    })
    .nullish()
    .transform((set) => set ?? undefined)

const ValueMetadataSchema = z.object({
    id: z.string().min(1),
    displayName: z.string(),
    displayFormName: optionalString,
    valueType: z.string(),
    optionSet: OptionSetSchema,
})

const ProgramStageSchema = z.object({
    id: z.string().min(1),
    displayName: z.string(),
    sortOrder: z
        .number()
        .nullish()
        .transform((value) => value ?? undefined),
    hideDueDate: flag,
    repeatable: flag,
    programStageDataElements: listOf(
        z.object({
            displayInReports: flag,
            dataElement: ValueMetadataSchema,
        })
    ),
})

export const ProgramTimelineMetadataSchema = z.object({
    id: z.string().min(1),
    displayName: z.string(),
    programStages: listOf(ProgramStageSchema),
    programTrackedEntityAttributes: listOf(
        z.object({ trackedEntityAttribute: ValueMetadataSchema })
    ),
})

export type ProgramTimelineMetadata = z.infer<
    typeof ProgramTimelineMetadataSchema
>

export const OrgUnitNamesSchema = z
    .object({
        organisationUnits: z.array(
            z.object({ id: z.string().min(1), displayName: z.string() })
        ),
    })
    .transform((response) => response.organisationUnits)

export type OrgUnitName = z.infer<typeof OrgUnitNamesSchema>[number]
