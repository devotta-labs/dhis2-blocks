import i18n from '@dhis2/d2-i18n'
import {
    isDataTableFilterValueEmpty,
    parseDataTableFilterValue,
    type DataTableFilter,
    type DataTableFilterOption,
    type DataTableFilterValue,
    type DataTableTextOperator,
} from '@/components/data-table'
import type { ColumnFiltersState } from '@tanstack/react-table'
import type {
    PatientListEnrollmentStatus,
    PatientListFilterQuery,
} from './types'

export type PatientListFilter = DataTableFilter & {
    /** The tracker query parts for an applied value. */
    toQuery: (value: DataTableFilterValue) => PatientListFilterQuery
}

interface AttributeFilterOptions {
    attribute: string
    label: string
    pinned?: boolean
}

type TextValue = Extract<DataTableFilterValue, { kind: 'text' }>

/** Escapes `/`, `:` and `,` with a leading `/`, as DHIS2 2.41+ expects. */
export const escapeFilterValue = (value: string) =>
    value.replaceAll('/', '//').replaceAll(':', '/:').replaceAll(',', '/,')

const NO_QUERY: PatientListFilterQuery = Object.freeze({})

const textOperators = {
    contains: 'like',
    equals: 'eq',
    startsWith: 'sw',
} as const

const textEntry = (attribute: string, value: TextValue) => {
    switch (value.operator) {
        case 'empty':
            return `${attribute}:null`
        case 'notEmpty':
            return `${attribute}:!null`
        default:
            return `${attribute}:${textOperators[value.operator]}:${escapeFilterValue(value.text)}`
    }
}

/** `A:ge:min:le:max`, or the one bound that is set. */
const rangeEntry = (
    attribute: string,
    lower: string | undefined,
    upper: string | undefined
): PatientListFilterQuery => {
    const bounds = [
        lower === undefined ? '' : `:ge:${escapeFilterValue(lower)}`,
        upper === undefined ? '' : `:le:${escapeFilterValue(upper)}`,
    ].join('')
    return bounds === '' ? NO_QUERY : { filters: [`${attribute}${bounds}`] }
}

const optionalString = (value: number | undefined) =>
    value === undefined ? undefined : String(value)

/** A text filter on an attribute. */
export const attributeTextFilter = ({
    attribute,
    label,
    pinned,
    operators,
    placeholder,
}: AttributeFilterOptions & {
    operators?: readonly DataTableTextOperator[]
    placeholder?: string
}): PatientListFilter => ({
    id: attribute,
    kind: 'text',
    label,
    pinned,
    operators,
    placeholder,
    toQuery: (value) =>
        value.kind === 'text'
            ? { filters: [textEntry(attribute, value)] }
            : NO_QUERY,
})

/** A number range filter on an attribute. */
export const attributeNumberFilter = ({
    attribute,
    label,
    pinned,
    min,
    max,
    step,
}: AttributeFilterOptions & {
    min?: number
    max?: number
    step?: number
}): PatientListFilter => ({
    id: attribute,
    kind: 'number',
    label,
    pinned,
    min,
    max,
    step,
    toQuery: (value) =>
        value.kind === 'number'
            ? rangeEntry(
                  attribute,
                  optionalString(value.min),
                  optionalString(value.max)
              )
            : NO_QUERY,
})

/** A date range filter on an attribute. */
export const attributeDateFilter = ({
    attribute,
    label,
    pinned,
}: AttributeFilterOptions): PatientListFilter => ({
    id: attribute,
    kind: 'date',
    label,
    pinned,
    toQuery: (value) =>
        value.kind === 'date'
            ? rangeEntry(attribute, value.from, value.to)
            : NO_QUERY,
})

/** A filter on an attribute's value from a list of options. */
export const attributeOptionsFilter = ({
    attribute,
    label,
    pinned,
    options,
    multiple,
}: AttributeFilterOptions & {
    options: readonly DataTableFilterOption[]
    multiple?: boolean
}): PatientListFilter => ({
    id: attribute,
    kind: 'options',
    label,
    pinned,
    options,
    multiple,
    toQuery: (value) => {
        if (value.kind !== 'options' || value.values.length === 0) {
            return NO_QUERY
        }
        const escaped = value.values.map(escapeFilterValue)
        return {
            filters: [
                escaped.length === 1
                    ? `${attribute}:eq:${escaped[0]}`
                    : `${attribute}:in:${escaped.join(';')}`,
            ],
        }
    },
})

/** A yes/no filter on a boolean attribute. */
export const attributeBooleanFilter = ({
    attribute,
    label,
    pinned,
    trueLabel,
    falseLabel,
}: AttributeFilterOptions & {
    trueLabel?: string
    falseLabel?: string
}): PatientListFilter => ({
    id: attribute,
    kind: 'boolean',
    label,
    pinned,
    trueLabel,
    falseLabel,
    toQuery: (value) =>
        value.kind === 'boolean'
            ? { filters: [`${attribute}:eq:${String(value.value)}`] }
            : NO_QUERY,
})

const ENROLLMENT_STATUSES: readonly PatientListEnrollmentStatus[] = [
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
]

/** The status of the enrollment in the list's program. */
export const enrollmentStatusFilter = ({
    label,
    pinned,
}: { label?: string; pinned?: boolean } = {}): PatientListFilter => ({
    id: 'enrollmentStatus',
    kind: 'options',
    label: label ?? i18n.t('Enrollment status'),
    pinned,
    multiple: false,
    options: [
        { value: 'ACTIVE', label: i18n.t('Active') },
        { value: 'COMPLETED', label: i18n.t('Completed') },
        { value: 'CANCELLED', label: i18n.t('Cancelled') },
    ],
    toQuery: (value) => {
        if (value.kind !== 'options') return NO_QUERY
        const enrollmentStatus = ENROLLMENT_STATUSES.find(
            (status) => status === value.values[0]
        )
        return enrollmentStatus === undefined ? NO_QUERY : { enrollmentStatus }
    },
})

/** The enrollment date or incident date of the enrollment in the program. */
export const enrollmentDateFilter = ({
    field,
    label,
    pinned,
}: {
    field: 'enrolledAt' | 'occurredAt'
    label: string
    pinned?: boolean
}): PatientListFilter => ({
    id: field,
    kind: 'date',
    label,
    pinned,
    toQuery: (value) => {
        if (value.kind !== 'date') return NO_QUERY
        const query: PatientListFilterQuery = {}
        const [after, before] =
            field === 'enrolledAt'
                ? (['enrolledAfter', 'enrolledBefore'] as const)
                : (['occurredAfter', 'occurredBefore'] as const)
        if (value.from !== undefined) query[after] = value.from
        if (value.to !== undefined) query[before] = value.to
        return query
    },
})

const SCALAR_KEYS = [
    'enrollmentStatus',
    'enrolledAfter',
    'enrolledBefore',
    'occurredAfter',
    'occurredBefore',
] as const

/** `later` over `earlier`: filters concatenate, params merge, scalars are replaced. */
const mergeQueries = (
    earlier: PatientListFilterQuery,
    later: PatientListFilterQuery
): PatientListFilterQuery => {
    const merged: PatientListFilterQuery = {}
    const filters = [...(earlier.filters ?? []), ...(later.filters ?? [])]
    if (filters.length > 0) merged.filters = filters
    for (const key of SCALAR_KEYS) {
        const value = later[key] ?? earlier[key]
        if (value !== undefined) Object.assign(merged, { [key]: value })
    }
    if (earlier.params !== undefined || later.params !== undefined) {
        merged.params = { ...earlier.params, ...later.params }
    }
    return merged
}

/**
 * The query parts of `baseQuery` and of every applied filter, in `filters`
 * order. Entries with unknown ids, unreadable values or empty values are left
 * out.
 */
export const toPatientListFilterQuery = (
    filters: readonly PatientListFilter[],
    columnFilters: ColumnFiltersState,
    baseQuery: PatientListFilterQuery = NO_QUERY
): PatientListFilterQuery => {
    let query = mergeQueries(NO_QUERY, baseQuery)
    for (const filter of filters) {
        const entry = columnFilters.find(({ id }) => id === filter.id)
        const value = entry && parseDataTableFilterValue(entry)
        if (value === undefined || isDataTableFilterValueEmpty(value)) continue
        query = mergeQueries(query, filter.toQuery(value))
    }
    return query
}
