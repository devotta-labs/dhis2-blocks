import type { WorkingListCapabilities } from '../api/capabilities'
import type { DataEngineQueryParameters } from '../api/client'
import {
    TRACKER_ENROLLMENT_STATUSES,
    TRACKER_EVENT_STATUSES,
} from '../api/schemas'
import type {
    AppliedFilter,
    FilterOperator,
    FilterScope,
    FilterValue,
    WorkingListField,
} from '../domain/model'
import { UidSchema } from '../domain/schemas'
import type { FilterSerializationContext } from './valueTypes'
import { getValueTypeDefinition } from './valueTypes'

export type SystemFilterId =
    | 'enrollmentStatus'
    | 'enrolledAt'
    | 'enrollmentOccurredAt'
    | 'followUp'
    | 'assignedUser'
    | 'programStage'
    | 'eventOccurredAt'
    | 'eventStatus'
    | 'eventScheduledAt'
    | 'eventAssignedUser'

export interface SystemFilterDefinition {
    id: SystemFilterId
    field: WorkingListField
    defaultVisible: boolean
    changesResultMode?: boolean
    operators: readonly FilterOperator[]
    validate(filter: AppliedFilter): void
    toQueryParameters(
        filter: AppliedFilter,
        capabilities: WorkingListCapabilities,
        context?: FilterSerializationContext
    ): DataEngineQueryParameters
}

const optionValue = (value: FilterValue) => {
    if (value.kind !== 'options' || value.values.length !== 1) {
        throw new Error('System status filters require exactly one option')
    }
    return value.values[0]
}

const validateOperator = (
    filter: AppliedFilter,
    operators: readonly FilterOperator[]
) => {
    if (!operators.includes(filter.operator)) {
        throw new Error(
            `${filter.field.id} does not support ${filter.operator}`
        )
    }
}

const optionValidator =
    (allowedValues: ReadonlySet<string>): SystemFilterDefinition['validate'] =>
    (filter) => {
        validateOperator(filter, ['in'])
        const value = optionValue(filter.value)
        if (!allowedValues.has(value)) {
            throw new Error(`${value} is not valid for ${filter.field.id}`)
        }
    }

const validateDateFilter: SystemFilterDefinition['validate'] = (filter) => {
    validateOperator(filter, ['range'])
    if (filter.value.kind !== 'dateRange') {
        throw new Error(`${filter.field.id} requires a date range`)
    }
    getValueTypeDefinition('DATE').parseEditorValue(filter.value)
}

const validateBooleanFilter: SystemFilterDefinition['validate'] = (filter) => {
    validateOperator(filter, ['equals'])
    if (filter.value.kind !== 'boolean' || filter.value.values.length !== 1) {
        throw new Error(`${filter.field.id} requires exactly one boolean`)
    }
}

const validateAssigneeFilter: SystemFilterDefinition['validate'] = (filter) => {
    validateOperator(filter, ['equals'])
    if (filter.value.kind !== 'assignee') {
        throw new Error('Assigned-user filters require an assignee value')
    }
    if (
        filter.value.mode === 'PROVIDED' &&
        (!filter.value.userIds?.length ||
            filter.value.userIds.some(
                (userId) => !UidSchema.safeParse(userId).success
            ))
    ) {
        throw new Error(
            'PROVIDED assigned-user filters require valid DHIS2 user UIDs'
        )
    }
    if (filter.value.mode !== 'PROVIDED' && filter.value.userIds?.length) {
        throw new Error('Only PROVIDED assigned-user filters accept users')
    }
}

const dateParameters = ({
    filter,
    after,
    before,
    context,
}: {
    filter: AppliedFilter
    after: string
    before: string
    context?: FilterSerializationContext
}): DataEngineQueryParameters => {
    const serialized = getValueTypeDefinition('DATE').serializeQuery(
        filter,
        context
    )
    const parts = serialized.split(':')
    const ge = parts.indexOf('ge')
    const le = parts.indexOf('le')
    return {
        [after]: ge >= 0 ? parts[ge + 1] : undefined,
        [before]: le >= 0 ? parts[le + 1] : undefined,
    }
}

const assigneeParameters = (filter: AppliedFilter) => {
    if (filter.value.kind !== 'assignee') {
        throw new Error('Assigned-user filters require an assignee value')
    }
    return {
        assignedUserMode: filter.value.mode,
        assignedUsers:
            filter.value.mode === 'PROVIDED'
                ? filter.value.userIds?.join(',')
                : undefined,
    }
}

const systemField = ({
    id,
    displayName,
    scope,
    valueType,
    options,
    apiName,
}: {
    id: string
    displayName: string
    scope: FilterScope
    valueType: WorkingListField['valueType']
    options?: WorkingListField['options']
    apiName?: string
}): WorkingListField => ({
    id,
    apiName: apiName ?? id,
    displayName,
    source: 'system',
    scope,
    valueType,
    filterable: true,
    options,
})

const enrollmentStatusOptions = [
    { code: 'ACTIVE', displayName: 'Active' },
    { code: 'COMPLETED', displayName: 'Completed' },
    { code: 'CANCELLED', displayName: 'Cancelled' },
]

const eventStatusOptions = [
    { code: 'ACTIVE', displayName: 'Active' },
    { code: 'SCHEDULE', displayName: 'Scheduled' },
    { code: 'COMPLETED', displayName: 'Completed' },
    { code: 'OVERDUE', displayName: 'Overdue' },
    { code: 'SKIPPED', displayName: 'Skipped' },
    { code: 'VISITED', displayName: 'Visited' },
]

const knownEnrollmentStatuses = new Set<string>(TRACKER_ENROLLMENT_STATUSES)
const knownEventStatuses = new Set<string>(TRACKER_EVENT_STATUSES)

if (
    enrollmentStatusOptions.some(
        (option) => !knownEnrollmentStatuses.has(option.code)
    ) ||
    TRACKER_ENROLLMENT_STATUSES.some(
        (status) =>
            !enrollmentStatusOptions.some((option) => option.code === status)
    ) ||
    eventStatusOptions.some((option) => !knownEventStatuses.has(option.code)) ||
    TRACKER_EVENT_STATUSES.some(
        (status) => !eventStatusOptions.some((option) => option.code === status)
    )
) {
    throw new Error('System status options are not aligned with Tracker enums')
}

const enrollmentStatuses = new Set(
    enrollmentStatusOptions.map((option) => option.code)
)
const eventStatuses = new Set(eventStatusOptions.map((option) => option.code))

const definitions: SystemFilterDefinition[] = [
    {
        id: 'enrollmentStatus',
        field: systemField({
            id: 'enrollmentStatus',
            displayName: 'Enrollment status',
            scope: 'trackedEntity',
            valueType: 'TEXT',
            options: enrollmentStatusOptions,
        }),
        defaultVisible: true,
        operators: ['in'],
        validate: optionValidator(enrollmentStatuses),
        toQueryParameters(filter, capabilities) {
            return {
                [capabilities.enrollmentStatusParameter]: optionValue(
                    filter.value
                ),
            }
        },
    },
    {
        id: 'enrolledAt',
        field: systemField({
            id: 'enrolledAt',
            displayName: 'Enrollment date',
            scope: 'trackedEntity',
            valueType: 'DATE',
        }),
        defaultVisible: true,
        operators: ['range'],
        validate: validateDateFilter,
        toQueryParameters(filter, _capabilities, context) {
            return dateParameters({
                filter,
                after: 'enrollmentEnrolledAfter',
                before: 'enrollmentEnrolledBefore',
                context,
            })
        },
    },
    {
        id: 'enrollmentOccurredAt',
        field: systemField({
            id: 'enrollmentOccurredAt',
            displayName: 'Incident date',
            scope: 'trackedEntity',
            valueType: 'DATE',
        }),
        defaultVisible: true,
        operators: ['range'],
        validate: validateDateFilter,
        toQueryParameters(filter, _capabilities, context) {
            return dateParameters({
                filter,
                after: 'enrollmentOccurredAfter',
                before: 'enrollmentOccurredBefore',
                context,
            })
        },
    },
    {
        id: 'followUp',
        field: systemField({
            id: 'followUp',
            displayName: 'Follow up',
            scope: 'trackedEntity',
            valueType: 'BOOLEAN',
        }),
        defaultVisible: false,
        operators: ['equals'],
        validate: validateBooleanFilter,
        toQueryParameters(filter) {
            if (
                filter.value.kind !== 'boolean' ||
                filter.value.values.length !== 1
            ) {
                throw new Error('Follow-up requires exactly one boolean value')
            }
            return { followUp: filter.value.values[0] }
        },
    },
    {
        id: 'assignedUser',
        field: systemField({
            id: 'assignedUser',
            displayName: 'Assigned to',
            scope: 'trackedEntity',
            valueType: 'USERNAME',
        }),
        defaultVisible: false,
        operators: ['equals'],
        validate: validateAssigneeFilter,
        toQueryParameters: assigneeParameters,
    },
    {
        id: 'programStage',
        field: systemField({
            id: 'programStage',
            displayName: 'Program stage',
            scope: 'event',
            valueType: 'TEXT',
        }),
        defaultVisible: true,
        changesResultMode: true,
        operators: [],
        validate(filter) {
            throw new Error(`${filter.field.id} changes result mode`)
        },
        toQueryParameters() {
            return {}
        },
    },
    {
        id: 'eventOccurredAt',
        field: systemField({
            id: 'eventOccurredAt',
            displayName: 'Report date',
            scope: 'event',
            valueType: 'DATE',
            apiName: 'occurredAt',
        }),
        defaultVisible: true,
        operators: ['range'],
        validate: validateDateFilter,
        toQueryParameters(filter, _capabilities, context) {
            return dateParameters({
                filter,
                after: 'occurredAfter',
                before: 'occurredBefore',
                context,
            })
        },
    },
    {
        id: 'eventStatus',
        field: systemField({
            id: 'eventStatus',
            displayName: 'Event status',
            scope: 'event',
            valueType: 'TEXT',
            options: eventStatusOptions,
            apiName: 'status',
        }),
        defaultVisible: true,
        operators: ['in'],
        validate: optionValidator(eventStatuses),
        toQueryParameters(filter) {
            return { status: optionValue(filter.value) }
        },
    },
    {
        id: 'eventScheduledAt',
        field: systemField({
            id: 'eventScheduledAt',
            displayName: 'Scheduled date',
            scope: 'event',
            valueType: 'DATE',
            apiName: 'scheduledAt',
        }),
        defaultVisible: true,
        operators: ['range'],
        validate: validateDateFilter,
        toQueryParameters(filter, _capabilities, context) {
            return dateParameters({
                filter,
                after: 'scheduledAfter',
                before: 'scheduledBefore',
                context,
            })
        },
    },
    {
        id: 'eventAssignedUser',
        field: systemField({
            id: 'eventAssignedUser',
            displayName: 'Assigned to',
            scope: 'event',
            valueType: 'USERNAME',
            apiName: 'assignedUser',
        }),
        defaultVisible: false,
        operators: ['equals'],
        validate: validateAssigneeFilter,
        toQueryParameters: assigneeParameters,
    },
]

export const systemFilterRegistry: ReadonlyMap<
    SystemFilterId,
    SystemFilterDefinition
> = new Map(definitions.map((definition) => [definition.id, definition]))

export const getSystemFilterDefinition = (id: string) =>
    definitions.find((definition) => definition.id === id)

export const getSystemFilterOperators = (
    id: string
): readonly FilterOperator[] | undefined =>
    getSystemFilterDefinition(id)?.operators

export const validateSystemFilter = (filter: AppliedFilter) => {
    const definition = getSystemFilterDefinition(filter.field.id)
    if (!definition) {
        throw new Error(`Unknown system filter ${filter.field.id}`)
    }
    if (filter.field.source !== 'system') {
        throw new Error(`${filter.field.id} is not a system filter`)
    }
    definition.validate(filter)
    return filter
}

export const systemColumnFields: WorkingListField[] = [
    {
        id: 'createdAt',
        apiName: 'createdAt',
        displayName: 'Registration date',
        source: 'system',
        scope: 'trackedEntity',
        valueType: 'DATETIME',
        filterable: false,
    },
    {
        id: 'programOwnerId',
        apiName: 'programOwner',
        displayName: 'Owner organisation unit',
        source: 'system',
        scope: 'trackedEntity',
        valueType: 'ORGANISATION_UNIT',
        filterable: false,
    },
    {
        id: 'eventOrgUnit',
        apiName: 'orgUnit',
        displayName: 'Event organisation unit',
        source: 'system',
        scope: 'event',
        valueType: 'ORGANISATION_UNIT',
        filterable: false,
    },
]
