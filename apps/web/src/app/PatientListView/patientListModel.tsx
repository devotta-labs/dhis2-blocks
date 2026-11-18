import type {
    DataTableColumnDef,
    DataTableTextOperator,
} from '@/components/data-table'
import {
    formatDhis2Value,
    type FormatOptions,
} from '@/components/dhis2-value-display'
import {
    attributeBooleanFilter,
    attributeColumn,
    attributeDateFilter,
    attributeNumberFilter,
    attributeOptionsFilter,
    attributeTextFilter,
    enrollmentDateFilter,
    enrollmentStatusFilter,
    fieldColumn,
    type PatientListFilter,
    type PatientListRow,
} from '@/components/patient-list'
import i18n from '../../i18n'
import type { ProgramListAttribute } from './programListMetadata'

// The app, not the patient list block, decides how program metadata becomes
// columns, cell text and filters.

const NUMERIC_VALUE_TYPES = new Set([
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
    'UNIT_INTERVAL',
])

const TEXT_VALUE_TYPES = new Set([
    'TEXT',
    'LONG_TEXT',
    'PHONE_NUMBER',
    'EMAIL',
    'USERNAME',
])

const TEXT_OPERATORS = [
    'contains',
    'equals',
    'startsWith',
] as const satisfies readonly DataTableTextOperator[]

const FORMAT_OPTIONS: FormatOptions = { calendar: 'iso8601' }

const PINNED_ATTRIBUTE_FILTERS = 2

const formatAttributeValue =
    ({ valueType, options }: ProgramListAttribute) =>
    (value: string | undefined) =>
        formatDhis2Value(
            value,
            { valueType, optionSet: options && { options } },
            FORMAT_OPTIONS
        )

const formatDate = (value: string | undefined) =>
    formatDhis2Value(value, { valueType: 'DATE' }, FORMAT_OPTIONS)

const formatEnrollmentStatus = (value: string | undefined) => {
    switch (value) {
        case 'ACTIVE':
            return i18n.t('Active')
        case 'COMPLETED':
            return i18n.t('Completed')
        case 'CANCELLED':
            return i18n.t('Cancelled')
        default:
            return value ?? ''
    }
}

export const buildPatientListColumns = (
    attributes: readonly ProgramListAttribute[]
): DataTableColumnDef<PatientListRow>[] => [
    ...attributes.map((attribute) =>
        attributeColumn(attribute.id, {
            header: attribute.label,
            format: formatAttributeValue(attribute),
            align: NUMERIC_VALUE_TYPES.has(attribute.valueType)
                ? 'end'
                : undefined,
        })
    ),
    fieldColumn('enrolledAt', {
        header: i18n.t('Enrollment date'),
        format: formatDate,
        nowrap: true,
    }),
    fieldColumn('enrollmentStatus', {
        header: i18n.t('Status'),
        format: formatEnrollmentStatus,
    }),
]

/** Attributes the program keeps out of its list start hidden. */
export const buildInitialColumnVisibility = (
    attributes: readonly ProgramListAttribute[]
) =>
    Object.fromEntries(
        attributes
            .filter(({ displayInList }) => !displayInList)
            .map(({ id }) => [id, false])
    )

const attributeFilter = (
    attribute: ProgramListAttribute,
    pinned: boolean
): PatientListFilter | undefined => {
    const base = { attribute: attribute.id, label: attribute.label, pinned }
    if (attribute.options) {
        return attributeOptionsFilter({
            ...base,
            options: attribute.options.map(({ code, displayName }) => ({
                value: code,
                label: displayName,
            })),
            multiple: true,
        })
    }
    if (TEXT_VALUE_TYPES.has(attribute.valueType)) {
        return attributeTextFilter({ ...base, operators: TEXT_OPERATORS })
    }
    if (NUMERIC_VALUE_TYPES.has(attribute.valueType)) {
        return attributeNumberFilter(base)
    }
    switch (attribute.valueType) {
        case 'DATE':
            return attributeDateFilter(base)
        case 'BOOLEAN':
            return attributeBooleanFilter(base)
        default:
            return undefined
    }
}

/**
 * Enrollment status, then one filter per attribute whose value type can be
 * filtered, then the enrollment date. The first two attributes a program both
 * lists and searches by get pinned chips.
 */
export const buildPatientListFilters = (
    attributes: readonly ProgramListAttribute[]
): PatientListFilter[] => {
    const pinnedIds = new Set(
        attributes
            .filter(
                ({ searchable, displayInList }) => searchable && displayInList
            )
            .slice(0, PINNED_ATTRIBUTE_FILTERS)
            .map(({ id }) => id)
    )
    return [
        enrollmentStatusFilter({ pinned: true }),
        ...attributes.flatMap((attribute) => {
            const filter = attributeFilter(
                attribute,
                pinnedIds.has(attribute.id)
            )
            return filter ? [filter] : []
        }),
        enrollmentDateFilter({
            field: 'enrolledAt',
            label: i18n.t('Enrollment date'),
        }),
    ]
}
