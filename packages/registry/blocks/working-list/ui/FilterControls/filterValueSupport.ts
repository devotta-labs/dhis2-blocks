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
import type { WorkingListTranslate } from '../WorkingListText'

export { fieldDisplayName, localizedField, optionDisplayName }

export const translatedOperator = (
    operator: FilterOperator,
    translate: WorkingListTranslate
) => {
    switch (operator) {
        case 'like':
            return translate('Contains')
        case 'startsWith':
            return translate('Starts with')
        case 'endsWith':
            return translate('Ends with')
        case 'equals':
            return translate('Equals')
        case 'range':
            return translate('Between')
        case 'greaterThan':
            return translate('Greater than')
        case 'greaterThanOrEqual':
            return translate('At least')
        case 'lessThan':
            return translate('Less than')
        case 'lessThanOrEqual':
            return translate('At most')
        case 'in':
            return translate('Is one of')
        case 'empty':
            return translate('Is empty')
        case 'notEmpty':
            return translate('Is not empty')
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

export const summaryForFilter = (
    filter: AppliedFilter | undefined,
    translate: WorkingListTranslate
) => {
    const i18n = { t: translate }
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
                        ? optionDisplayName(filter.field, option, translate)
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
