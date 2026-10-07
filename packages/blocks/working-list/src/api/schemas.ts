import { z } from 'zod'
import { RELATIVE_DATE_PERIODS } from '../domain/model'
import { Dhis2ValueTypeSchema } from '../domain/schemas'

const OptionalStringSchema = z.string().nullish()

const OptionalStringArraySchema = z.array(z.string()).nullish()

const LooseReferenceSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().optional(),
    })
    .passthrough()

const NormalizedReferenceSchema = z.union([
    LooseReferenceSchema,
    z
        .string()
        .min(1)
        .transform((id) => ({ id })),
])

const OptionSchema = z
    .object({
        id: z.string().min(1).optional(),
        code: z.string(),
        displayName: z.string(),
    })
    .passthrough()

const OptionSetSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().optional(),
        options: z.array(OptionSchema).optional(),
    })
    .passthrough()

const SearchOperatorSchema = z.enum([
    'LIKE',
    'SW',
    'EW',
    'EQ',
    'RANGE',
    'GE',
    'LE',
    'NULL',
    '!NULL',
])

const TrackedEntityAttributeSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        formName: z.string().nullable().optional(),
        displayFormName: z.string().nullable().optional(),
        valueType: Dhis2ValueTypeSchema,
        optionSet: OptionSetSchema.nullable().optional(),
        unique: z.boolean().optional(),
        searchable: z.boolean().optional(),
        preferredSearchOperator: SearchOperatorSchema.nullable().optional(),
        blockedSearchOperators: z.array(SearchOperatorSchema).optional(),
        minCharactersToSearch: z.number().int().nonnegative().optional(),
    })
    .passthrough()

const ProgramTrackedEntityAttributeSchema = z
    .object({
        displayInList: z.boolean().optional(),
        mandatory: z.boolean().optional(),
        searchable: z.boolean().optional(),
        preferredSearchOperator: SearchOperatorSchema.nullable().optional(),
        blockedSearchOperators: z.array(SearchOperatorSchema).optional(),
        minCharactersToSearch: z.number().int().nonnegative().optional(),
        trackedEntityAttribute: TrackedEntityAttributeSchema,
    })
    .passthrough()

const DataElementSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        formName: z.string().nullable().optional(),
        displayFormName: z.string().nullable().optional(),
        valueType: Dhis2ValueTypeSchema,
        optionSet: OptionSetSchema.nullable().optional(),
    })
    .passthrough()

const ProgramStageDataElementSchema = z
    .object({
        displayInReports: z.boolean().optional(),
        compulsory: z.boolean().optional(),
        dataElement: DataElementSchema,
    })
    .passthrough()

const ProgramStageSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        displayExecutionDateLabel: OptionalStringSchema,
        displayDueDateLabel: OptionalStringSchema,
        hideDueDate: z.boolean().optional(),
        enableUserAssignment: z.boolean().optional(),
        access: z
            .object({ read: z.boolean().optional() })
            .passthrough()
            .optional(),
        programStageDataElements: z.array(ProgramStageDataElementSchema),
    })
    .passthrough()

export const TrackerProgramSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        programType: z.string().optional(),
        displayEnrollmentDateLabel: OptionalStringSchema,
        displayIncidentDate: z.boolean().optional(),
        displayIncidentDateLabel: OptionalStringSchema,
        trackedEntityType: LooseReferenceSchema.optional(),
        access: z
            .object({
                read: z.boolean().optional(),
                data: z
                    .object({ read: z.boolean().optional() })
                    .passthrough()
                    .optional(),
            })
            .passthrough()
            .optional(),
        programTrackedEntityAttributes: z.array(
            ProgramTrackedEntityAttributeSchema
        ),
        programStages: z.array(ProgramStageSchema),
    })
    .passthrough()

const TrackerProgramSummarySchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        programType: z.string(),
        style: z
            .object({
                color: z.string().optional(),
                icon: z.string().optional(),
            })
            .passthrough()
            .optional(),
        organisationUnits: z
            .array(
                z
                    .object({
                        id: z.string().min(1),
                        displayName: z.string(),
                        path: z.string().min(1),
                    })
                    .passthrough()
            )
            .optional(),
        access: z
            .object({
                read: z.boolean().optional(),
                data: z
                    .object({ read: z.boolean().optional() })
                    .passthrough()
                    .optional(),
            })
            .passthrough()
            .optional(),
    })
    .passthrough()

export const TrackerProgramsResponseSchema = z
    .object({
        programs: z.array(TrackerProgramSummarySchema),
        pager: z.unknown().optional(),
    })
    .passthrough()

const PagerSchema = z
    .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative().optional(),
        pageCount: z.number().int().nonnegative().optional(),
        nextPage: z.string().optional(),
        prevPage: z.string().optional(),
    })
    .passthrough()

const TrackedEntityAttributeValueSchema = z
    .object({
        attribute: z.string().min(1),
        value: z.union([z.string(), z.number(), z.boolean()]),
    })
    .passthrough()

const TrackedEntitySchema = z
    .object({
        trackedEntity: z.string().min(1),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        inactive: z.boolean().optional(),
        attributes: z.array(TrackedEntityAttributeValueSchema),
        programOwners: z.array(
            z
                .object({
                    orgUnit: z.string().min(1),
                    program: z.string().min(1).optional(),
                })
                .passthrough()
        ),
        enrollments: z
            .array(z.object({ enrollment: z.string().min(1) }).passthrough())
            .optional(),
    })
    .passthrough()

export const TrackedEntitiesResponseSchema = z
    .object({
        trackedEntities: z.array(TrackedEntitySchema).optional(),
        instances: z.array(TrackedEntitySchema).optional(),
        pager: PagerSchema.optional(),
    })
    .passthrough()
    .superRefine((value, context) => {
        if (!value.trackedEntities && !value.instances) {
            context.addIssue({
                code: 'custom',
                message:
                    'Tracker response requires trackedEntities or legacy instances',
            })
        }
    })

export const normalizeTrackedEntitiesResponse = (
    response: z.infer<typeof TrackedEntitiesResponseSchema>
) => {
    return {
        trackedEntities: response.trackedEntities ?? response.instances ?? [],
        pager: response.pager,
    }
}

const EventDataValueSchema = z
    .object({
        dataElement: z.string().min(1),
        value: z.union([z.string(), z.number(), z.boolean()]),
    })
    .passthrough()

export const TRACKER_EVENT_STATUSES = [
    'ACTIVE',
    'COMPLETED',
    'OVERDUE',
    'SCHEDULE',
    'SKIPPED',
    'VISITED',
] as const

export const TrackerEventStatusSchema = z.enum(TRACKER_EVENT_STATUSES)

export const TRACKER_ENROLLMENT_STATUSES = [
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
] as const

export const TrackerEnrollmentStatusSchema = z.enum(TRACKER_ENROLLMENT_STATUSES)

const EventSchema = z
    .object({
        event: z.string().min(1),
        status: TrackerEventStatusSchema,
        program: z.string().min(1),
        programStage: z.string().min(1).optional(),
        enrollment: z.string().min(1).optional(),
        trackedEntity: z.string().min(1).optional(),
        occurredAt: z.string().optional(),
        scheduledAt: z.string().optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        orgUnit: z.string().min(1),
        assignedUser: z
            .object({
                uid: z.string().min(1),
                username: z.string().optional(),
                displayName: z.string().optional(),
                firstName: z.string().optional(),
                surname: z.string().optional(),
            })
            .passthrough()
            .nullable()
            .optional(),
        dataValues: z.array(EventDataValueSchema),
    })
    .passthrough()

export const EventsResponseSchema = z
    .object({
        events: z.array(EventSchema).optional(),
        instances: z.array(EventSchema).optional(),
        pager: PagerSchema.optional(),
    })
    .passthrough()
    .superRefine((value, context) => {
        if (!value.events && !value.instances) {
            context.addIssue({
                code: 'custom',
                message: 'Tracker response requires events or legacy instances',
            })
        }
    })

export const normalizeEventsResponse = (
    response: z.infer<typeof EventsResponseSchema>
) => {
    return {
        events: response.events ?? response.instances ?? [],
        pager: response.pager,
    }
}

const AccessSchema = z
    .object({
        read: z.boolean().optional(),
        update: z.boolean().optional(),
        delete: z.boolean().optional(),
        manage: z.boolean().optional(),
        externalize: z.boolean().optional(),
        write: z.boolean().optional(),
    })
    .passthrough()

const SharingAccessStringSchema = z
    .string()
    .regex(/^[rwx-]{8}$/, 'Expected an eight-character DHIS2 access string')

const SharingAccessEntrySchema = z
    .object({
        id: z.string().min(1),
        access: SharingAccessStringSchema,
        displayName: z.string().optional(),
    })
    .passthrough()

export const DateFilterContentsSchema = z
    .object({
        type: z.enum(['ABSOLUTE', 'RELATIVE']),
        startDate: OptionalStringSchema,
        endDate: OptionalStringSchema,
        period: z.enum(RELATIVE_DATE_PERIODS).nullish(),
        startBuffer: z.number().int().nullish(),
        endBuffer: z.number().int().nullish(),
    })
    .passthrough()
    .superRefine((value, context) => {
        const addIssue = (message: string) =>
            context.addIssue({ code: 'custom', message })

        if (value.type === 'ABSOLUTE') {
            if (!value.startDate && !value.endDate) {
                addIssue('An absolute date filter requires a start or end date')
            }

            if (
                value.period != null ||
                value.startBuffer != null ||
                value.endBuffer != null
            ) {
                addIssue(
                    'An absolute date filter cannot contain relative fields'
                )
            }

            return
        }

        if (value.startDate != null || value.endDate != null) {
            addIssue('A relative date filter cannot contain absolute dates')
        }

        const hasPeriod = value.period != null

        const hasBothBuffers =
            value.startBuffer != null && value.endBuffer != null

        if (hasPeriod === hasBothBuffers) {
            addIssue(
                'A relative date filter requires one period or both buffers'
            )
        }

        if (
            hasBothBuffers &&
            (value.startBuffer! > 0 || value.endBuffer! < 0)
        ) {
            addIssue(
                'Relative date buffers require a non-positive start and non-negative end'
            )
        }
    })

const SavedValueFilterSchema = z
    .object({
        attribute: OptionalStringSchema,
        dataItem: OptionalStringSchema,
        eq: OptionalStringSchema,
        sw: OptionalStringSchema,
        ew: OptionalStringSchema,
        like: OptionalStringSchema,
        ge: OptionalStringSchema,
        le: OptionalStringSchema,
        in: OptionalStringArraySchema,
        null: z.boolean().nullish(),
        dateFilter: DateFilterContentsSchema.nullish(),
    })
    .passthrough()
    .superRefine((value, context) => {
        const references = [value.attribute, value.dataItem].filter(
            (item) => item != null
        )

        if (references.length !== 1) {
            context.addIssue({
                code: 'custom',
                message:
                    'A saved value filter requires exactly one attribute or data item',
            })
        }

        const scalarValues = [
            value.eq,
            value.sw,
            value.ew,
            value.like,
            value.ge,
            value.le,
        ].filter((item) => item != null)

        const families = [
            scalarValues.length > 0,
            value.in != null,
            value.null != null,
            value.dateFilter != null,
        ].filter(Boolean)

        if (families.length !== 1) {
            context.addIssue({
                code: 'custom',
                message: 'A saved value filter requires one value family',
            })
        }

        if (
            scalarValues.length > 1 &&
            !(value.ge != null && value.le != null && scalarValues.length === 2)
        ) {
            context.addIssue({
                code: 'custom',
                message: 'A saved scalar filter contains conflicting operators',
            })
        }

        if (value.in != null && !value.in.length) {
            context.addIssue({
                code: 'custom',
                message: 'A saved option filter requires at least one value',
            })
        }
    })

const SavedCriteriaFields = {
    enrollmentStatus: TrackerEnrollmentStatusSchema.nullish(),
    order: OptionalStringSchema,
    displayColumnOrder: OptionalStringArraySchema,
    assignedUserMode: z.enum(['CURRENT', 'PROVIDED', 'NONE', 'ANY']).nullish(),
    assignedUsers: OptionalStringArraySchema,
    followUp: z.union([z.boolean(), z.enum(['true', 'false'])]).nullish(),
    attributeValueFilters: z.array(SavedValueFilterSchema).nullish(),
}

const EntityQueryCriteriaSchema = z
    .object({
        ...SavedCriteriaFields,
        enrollmentCreatedDate: DateFilterContentsSchema.nullish(),
        enrollmentIncidentDate: DateFilterContentsSchema.nullish(),
    })
    .passthrough()

const ProgramStageQueryCriteriaSchema = z
    .object({
        ...SavedCriteriaFields,
        enrolledAt: DateFilterContentsSchema.nullish(),
        enrollmentOccurredAt: DateFilterContentsSchema.nullish(),
        eventStatus: TrackerEventStatusSchema.nullish(),
        eventOccurredAt: DateFilterContentsSchema.nullish(),
        eventScheduledAt: DateFilterContentsSchema.nullish(),
        dataFilters: z.array(SavedValueFilterSchema).nullish(),
    })
    .passthrough()

const SharingFields = {
    access: AccessSchema.optional(),
    externalAccess: z.boolean().optional(),
    publicAccess: SharingAccessStringSchema.optional(),
    user: LooseReferenceSchema.optional(),
    userAccesses: z.array(SharingAccessEntrySchema).optional(),
    userGroupAccesses: z.array(SharingAccessEntrySchema).optional(),
}

export const TrackedEntityInstanceFilterSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        sortOrder: z.number().int().nonnegative().optional(),
        program: NormalizedReferenceSchema,
        entityQueryCriteria: EntityQueryCriteriaSchema.optional(),
        ...SharingFields,
    })
    .passthrough()

export const ProgramStageWorkingListSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        sortOrder: z.number().int().nonnegative().optional(),
        program: NormalizedReferenceSchema,
        programStage: NormalizedReferenceSchema,
        programStageQueryCriteria: ProgramStageQueryCriteriaSchema.optional(),
        ...SharingFields,
    })
    .passthrough()

export const TrackedEntityInstanceFiltersResponseSchema = z
    .object({
        trackedEntityInstanceFilters: z.array(
            TrackedEntityInstanceFilterSchema
        ),
        pager: PagerSchema.optional(),
    })
    .passthrough()

export const ProgramStageWorkingListsResponseSchema = z
    .object({
        programStageWorkingLists: z.array(ProgramStageWorkingListSchema),
        pager: PagerSchema.optional(),
    })
    .passthrough()

export const MutationResponseSchema = z
    .object({
        httpStatus: z.string().optional(),
        httpStatusCode: z.number().int().optional(),
        response: z
            .object({ uid: z.string().min(1).optional() })
            .passthrough()
            .optional(),
        status: z.literal('OK'),
    })
    .passthrough()

/**
 * Data Engine returns the regular metadata mutation response for 200 deletes
 * and `undefined` when a DHIS2 version responds with 204 No Content.
 */
export const DeleteMutationResponseSchema = z.union([
    MutationResponseSchema,
    z.undefined(),
])

export type TrackerProgram = z.infer<typeof TrackerProgramSchema>

export type TrackedEntity = z.infer<typeof TrackedEntitySchema>

export type TrackerEvent = z.infer<typeof EventSchema>

export type EntityQueryCriteria = z.infer<typeof EntityQueryCriteriaSchema>

export type ProgramStageQueryCriteria = z.infer<
    typeof ProgramStageQueryCriteriaSchema
>

export type SavedValueFilter = z.infer<typeof SavedValueFilterSchema>

export type TrackedEntityInstanceFilter = z.infer<
    typeof TrackedEntityInstanceFilterSchema
>

export type ProgramStageWorkingList = z.infer<
    typeof ProgramStageWorkingListSchema
>
