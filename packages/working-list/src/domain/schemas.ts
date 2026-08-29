import { z } from 'zod'
import {
    DHIS2_VALUE_TYPES,
    FILTER_OPERATORS,
    FILTER_SOURCES,
    RELATIVE_DATE_PERIODS,
} from './model'

export const UidSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9]{10}$/)

export const Dhis2ValueTypeSchema = z.enum(DHIS2_VALUE_TYPES)
export const FilterOperatorSchema = z.enum(FILTER_OPERATORS)
export const FilterSourceSchema = z.enum(FILTER_SOURCES)

export const WorkingListFieldSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        displayNameIsMetadata: z.literal(true).optional(),
        source: FilterSourceSchema,
        scope: z.enum(['trackedEntity', 'event']),
        valueType: Dhis2ValueTypeSchema,
        apiName: z.string().min(1).optional(),
        optionSetId: z.string().min(1).optional(),
        options: z
            .array(
                z.object({
                    code: z.string(),
                    displayName: z.string(),
                })
            )
            .optional(),
        unique: z.boolean().optional(),
        searchable: z.boolean().optional(),
        filterable: z.boolean(),
        columnable: z.boolean().optional(),
        preferredSearchOperator: FilterOperatorSchema.optional(),
        blockedSearchOperators: z.array(FilterOperatorSchema).optional(),
        minCharactersToSearch: z.number().int().nonnegative().optional(),
        programStageIds: z.array(z.string().min(1)).optional(),
        required: z.boolean().optional(),
        requiredInStageIds: z.array(z.string().min(1)).optional(),
    })
    .strict()

const TextFilterValueSchema = z
    .object({ kind: z.literal('text'), value: z.string().min(1) })
    .strict()

const NumberFilterValueSchema = z
    .object({
        kind: z.literal('numberRange'),
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
    })
    .strict()
    .refine((value) => value.min !== undefined || value.max !== undefined, {
        message: 'A numeric filter requires a minimum or maximum',
    })

const TimeFilterValueSchema = z
    .object({
        kind: z.literal('timeRange'),
        min: z.string().min(1).optional(),
        max: z.string().min(1).optional(),
    })
    .strict()
    .refine((value) => value.min !== undefined || value.max !== undefined, {
        message: 'A time filter requires a minimum or maximum',
    })

const AbsoluteDateFilterValueSchema = z
    .object({
        kind: z.literal('dateRange'),
        mode: z.literal('absolute'),
        start: z.string().min(1).optional(),
        end: z.string().min(1).optional(),
    })
    .strict()
    .refine((value) => value.start !== undefined || value.end !== undefined, {
        message: 'An absolute date filter requires a start or end',
    })

const RelativeDateFilterValueSchema = z
    .object({
        kind: z.literal('dateRange'),
        mode: z.literal('relative'),
        period: z.enum(RELATIVE_DATE_PERIODS).optional(),
        startBuffer: z.number().int().optional(),
        endBuffer: z.number().int().optional(),
    })
    .strict()
    .refine(
        (value) => {
            if (value.period !== undefined) {
                return (
                    value.startBuffer === undefined &&
                    value.endBuffer === undefined
                )
            }
            return (
                value.startBuffer !== undefined &&
                value.startBuffer <= 0 &&
                value.endBuffer !== undefined &&
                value.endBuffer >= 0
            )
        },
        {
            message:
                'A relative date filter requires one period or a non-positive start and non-negative end buffer',
        }
    )

const BooleanFilterValueSchema = z
    .object({
        kind: z.literal('boolean'),
        values: z.array(z.boolean()).min(1),
    })
    .strict()

const OptionFilterValueSchema = z
    .object({
        kind: z.literal('options'),
        values: z.array(z.string()).min(1),
    })
    .strict()

const EmptyFilterValueSchema = z
    .object({ kind: z.literal('empty'), isEmpty: z.boolean() })
    .strict()

const TrueOnlyFilterValueSchema = z
    .object({ kind: z.literal('trueOnly'), value: z.literal(true) })
    .strict()

const OrganisationUnitFilterValueSchema = z
    .object({
        kind: z.literal('organisationUnit'),
        id: z.string().min(1),
    })
    .strict()

const AssigneeFilterValueSchema = z
    .object({
        kind: z.literal('assignee'),
        mode: z.enum(['CURRENT', 'PROVIDED', 'NONE', 'ANY']),
        userIds: z.array(z.string().min(1)).optional(),
    })
    .strict()
    .superRefine((value, context) => {
        if (value.mode === 'PROVIDED' && !value.userIds?.length) {
            context.addIssue({
                code: 'custom',
                message: 'PROVIDED assignee mode requires at least one user',
                path: ['userIds'],
            })
        }
        if (value.mode !== 'PROVIDED' && value.userIds?.length) {
            context.addIssue({
                code: 'custom',
                message: 'Only PROVIDED assignee mode accepts users',
                path: ['userIds'],
            })
        }
    })

export const FilterValueSchema = z.union([
    TextFilterValueSchema,
    NumberFilterValueSchema,
    TimeFilterValueSchema,
    z.union([AbsoluteDateFilterValueSchema, RelativeDateFilterValueSchema]),
    BooleanFilterValueSchema,
    OptionFilterValueSchema,
    EmptyFilterValueSchema,
    TrueOnlyFilterValueSchema,
    OrganisationUnitFilterValueSchema,
    AssigneeFilterValueSchema,
])

export const AppliedFilterSchema = z
    .object({
        field: WorkingListFieldSchema,
        operator: FilterOperatorSchema,
        value: FilterValueSchema,
    })
    .strict()

export const WorkingListSortSchema = z
    .object({
        fieldId: z.string().min(1),
        direction: z.enum(['asc', 'desc']),
    })
    .strict()

const workingListCriteriaFields = {
    programId: z.string().min(1),
    filters: z.array(AppliedFilterSchema),
}

const workingListViewFields = {
    columns: z.array(z.string().min(1)).min(1),
    sort: WorkingListSortSchema,
}

export const WorkingListViewConfigurationSchema = z
    .object(workingListViewFields)
    .strict()

export const TrackedEntityWorkingListCriteriaSchema = z
    .object({
        mode: z.literal('trackedEntity'),
        ...workingListCriteriaFields,
    })
    .strict()

export const EventWorkingListCriteriaSchema = z
    .object({
        mode: z.literal('event'),
        programStageId: z.string().min(1),
        ...workingListCriteriaFields,
    })
    .strict()

export const WorkingListCriteriaSchema = z.discriminatedUnion('mode', [
    TrackedEntityWorkingListCriteriaSchema,
    EventWorkingListCriteriaSchema,
])

export const TrackedEntityWorkingListConfigurationSchema = z
    .object({
        mode: z.literal('trackedEntity'),
        ...workingListCriteriaFields,
        ...workingListViewFields,
    })
    .strict()

export const EventWorkingListConfigurationSchema = z
    .object({
        mode: z.literal('event'),
        programStageId: z.string().min(1),
        ...workingListCriteriaFields,
        ...workingListViewFields,
    })
    .strict()

export const WorkingListConfigurationSchema = z.discriminatedUnion('mode', [
    TrackedEntityWorkingListConfigurationSchema,
    EventWorkingListConfigurationSchema,
])

export const WorkingListPaginationSchema = z
    .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive().max(1000),
    })
    .strict()

export const WorkingListContextSchema = z
    .object({
        programId: z.string().min(1),
        orgUnitId: z.string().min(1),
    })
    .strict()
