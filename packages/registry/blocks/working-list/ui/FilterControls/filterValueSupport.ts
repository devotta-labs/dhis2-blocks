import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import type {
    WorkingListCalendar,
    WorkingListDateFormat,
} from '../../api/systemInfo'
import {
    type AppliedFilter,
    type FilterOperator,
    type FilterValue,
    type WorkingListField,
} from '../../domain/model'
import {
    fieldDisplayName,
    localizedField,
    optionDisplayName,
} from '../../domain/filterControlPolicy'
import type { FilterEditorKind } from '../../registry/valueTypes'

export { fieldDisplayName, localizedField, optionDisplayName }

export const translatedOperator = (operator: FilterOperator) => {
    switch (operator) {
        case 'like':
            return i18n.t('Contains')
        case 'startsWith':
            return i18n.t('Starts with')
        case 'endsWith':
            return i18n.t('Ends with')
        case 'equals':
            return i18n.t('Equals')
        case 'range':
            return i18n.t('Between')
        case 'greaterThan':
            return i18n.t('Greater than')
        case 'greaterThanOrEqual':
            return i18n.t('At least')
        case 'lessThan':
            return i18n.t('Less than')
        case 'lessThanOrEqual':
            return i18n.t('At most')
        case 'in':
            return i18n.t('Is one of')
        case 'empty':
            return i18n.t('Is empty')
        case 'notEmpty':
            return i18n.t('Is not empty')
    }
}

export const CalendarSelectionSchema = z.union([
    z.null(),
    z
        .object({
            calendarDateString: z.string().nullable(),
            validation: z
                .object({
                    valid: z.boolean(),
                    error: z.boolean().optional(),
                    warning: z.boolean().optional(),
                    validationText: z.string().optional(),
                })
                .passthrough()
                .optional(),
        })
        .passthrough(),
])

export interface CalendarValidationFeedback {
    valid: boolean
    error?: boolean
    warning?: boolean
    validationText?: string
}

export interface FilterCalendarContext {
    calendar: WorkingListCalendar
    dateFormat: WorkingListDateFormat
    locale?: string
    /** Validated server zone, retained until CalendarInput consumes it safely. */
    timeZone: string
}

export const canonicalDateToCalendarInput = (
    value: string | undefined,
    format: WorkingListDateFormat
) => {
    if (!value || format === 'YYYY-MM-DD') {
        return value
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}

export const calendarInputDateToCanonical = (
    value: string | null | undefined,
    format: WorkingListDateFormat
) => {
    if (!value || format === 'YYYY-MM-DD') {
        return value || undefined
    }
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}
export const defaultValue = (
    field: WorkingListField,
    editor: FilterEditorKind
): FilterValue => {
    if (field.id === 'assignedUser' || field.id === 'eventAssignedUser') {
        return { kind: 'assignee', mode: 'CURRENT' }
    }
    if (field.options?.length) {
        return { kind: 'options', values: [] }
    }
    switch (editor) {
        case 'numberRange':
            return { kind: 'numberRange' }
        case 'timeRange':
            return { kind: 'timeRange' }
        case 'dateRange':
            return { kind: 'dateRange', mode: 'absolute' }
        case 'boolean':
            return { kind: 'boolean', values: [] }
        case 'trueOnly':
            return { kind: 'trueOnly', value: true }
        case 'organisationUnit':
            return { kind: 'organisationUnit', id: '' }
        default:
            return { kind: 'text', value: '' }
    }
}

export const summaryForFilter = (filter: AppliedFilter | undefined) => {
    if (!filter) {
        return undefined
    }
    const { value } = filter
    if (value.kind === 'empty') {
        return value.isEmpty ? i18n.t('Empty') : i18n.t('Not empty')
    }
    if (value.kind === 'text') {
        return value.value
    }
    if (value.kind === 'options') {
        return value.values
            .map((code) =>
                (() => {
                    const option = filter.field.options?.find(
                        (candidate) => candidate.code === code
                    )
                    return option
                        ? optionDisplayName(filter.field, option)
                        : code
                })()
            )
            .join(', ')
    }
    if (value.kind === 'boolean') {
        return value.values
            .map((item) => (item ? i18n.t('Yes') : i18n.t('No')))
            .join(', ')
    }
    if (value.kind === 'trueOnly') {
        return i18n.t('Yes')
    }
    if (value.kind === 'organisationUnit') {
        return value.id
    }
    if (value.kind === 'assignee') {
        if (value.mode === 'CURRENT') {
            return i18n.t('Current user')
        }
        if (value.mode === 'NONE') {
            return i18n.t('Unassigned')
        }
        if (value.mode === 'ANY') {
            return i18n.t('Any assigned user')
        }
        return value.userIds?.join(', ') || i18n.t('Selected users')
    }
    if (value.kind === 'dateRange') {
        if (value.mode === 'relative') {
            switch (value.period) {
                case 'TODAY':
                    return i18n.t('Today')
                case 'THIS_WEEK':
                    return i18n.t('This week')
                case 'LAST_WEEK':
                    return i18n.t('Last week')
                case 'THIS_MONTH':
                    return i18n.t('This month')
                case 'LAST_MONTH':
                    return i18n.t('Last month')
                case 'LAST_3_MONTHS':
                    return i18n.t('Last three months')
                case 'THIS_YEAR':
                    return i18n.t('This year')
                default:
                    return i18n.t('{{start}} to {{end}} days', {
                        start: value.startBuffer ?? 0,
                        end: value.endBuffer ?? 0,
                    })
            }
        }
        return [value.start, value.end].filter(Boolean).join(' – ')
    }
    if (value.kind === 'numberRange' || value.kind === 'timeRange') {
        return [value.min, value.max]
            .filter((item) => item !== undefined)
            .join(' – ')
    }
    return undefined
}
