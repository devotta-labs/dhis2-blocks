import { z } from 'zod'
import type { WorkingListCapabilities } from '../api/capabilities'
import type { SavedValueFilter } from '../api/schemas'
import type {
    AppliedFilter,
    Dhis2ValueType,
    FilterOperator,
    FilterValue,
    WorkingListField,
} from '../domain/model'
import type {
    CellDisplayValue,
    CellFormattingContext,
    WorkingListFileValue,
    WorkingListRawValue,
} from './valueTypeContracts'
import {
    ValueParseError,
    isWorkingListFileValue,
    isWorkingListUserValue,
} from './valueTypeContracts'

export const escapeFilterValue = (value: string) =>
    value.replaceAll('/', '//').replaceAll(':', '/:').replaceAll(',', '/,')

export const operatorToApi = (operator: FilterOperator) => {
    const operators = {
        like: 'like',
        startsWith: 'sw',
        endsWith: 'ew',
        equals: 'eq',
        greaterThan: 'gt',
        greaterThanOrEqual: 'ge',
        lessThan: 'lt',
        lessThanOrEqual: 'le',
        in: 'in',
        empty: 'null',
        notEmpty: '!null',
        range: undefined,
    } satisfies Record<FilterOperator, string | undefined>
    const result = operators[operator]
    if (!result) {
        throw new Error(`Filter operator ${operator} has no scalar API mapping`)
    }
    return result
}

export type SavedScalarApiOperator =
    | 'like'
    | 'sw'
    | 'ew'
    | 'eq'
    | 'ge'
    | 'le'
    | 'in'

export const apiToOperator = (
    operator: SavedScalarApiOperator
): FilterOperator => {
    const operators = {
        like: 'like',
        sw: 'startsWith',
        ew: 'endsWith',
        eq: 'equals',
        ge: 'greaterThanOrEqual',
        le: 'lessThanOrEqual',
        in: 'in',
    } satisfies Record<SavedScalarApiOperator, FilterOperator>
    const result = operators[operator]
    if (!result) {
        throw new Error(`Unknown saved-list filter operator: ${operator}`)
    }
    return result
}

export const emptyOperators = (
    capabilities: WorkingListCapabilities
): FilterOperator[] =>
    capabilities.emptyValueFilters ? ['empty', 'notEmpty'] : []

export const ensureEmptyValue = (filter: AppliedFilter) => {
    if (filter.value.kind !== 'empty') {
        return undefined
    }
    return filter.value.isEmpty ? 'null' : '!null'
}

export const serializeEmptySaved = (filter: AppliedFilter) => {
    if (filter.value.kind !== 'empty') {
        return undefined
    }
    return { null: filter.value.isEmpty }
}

export const parseEmptySaved = (
    filter: SavedValueFilter
): FilterValue | undefined =>
    filter.null === true || filter.null === false
        ? { kind: 'empty', isEmpty: filter.null }
        : undefined

export const textOperators = (
    field: WorkingListField,
    capabilities: WorkingListCapabilities
): FilterOperator[] => {
    if (field.optionSetId || field.options?.length) {
        return ['in', ...emptyOperators(capabilities)]
    }
    if (field.unique) {
        return ['equals', ...emptyOperators(capabilities)]
    }
    const defaults: FilterOperator[] = [
        'like',
        'startsWith',
        'equals',
        'endsWith',
    ]
    const blocked = new Set(
        capabilities.metadataSearchOperators
            ? (field.blockedSearchOperators ?? [])
            : []
    )
    const available = defaults.filter((operator) => !blocked.has(operator))
    if (
        capabilities.metadataSearchOperators &&
        field.preferredSearchOperator &&
        available.includes(field.preferredSearchOperator)
    ) {
        available.splice(available.indexOf(field.preferredSearchOperator), 1)
        available.unshift(field.preferredSearchOperator)
    }
    return [...available, ...emptyOperators(capabilities)]
}

export const formatText = (
    value: WorkingListRawValue,
    field: WorkingListField,
    context?: CellFormattingContext
) => {
    if (value === undefined || value === null || value === '') {
        return ''
    }
    if (isWorkingListUserValue(value)) {
        return value.username ? `${value.name} (${value.username})` : value.name
    }
    if (isWorkingListFileValue(value)) {
        return field.valueType === 'FILE_RESOURCE'
            ? (context?.resolveFileResourceName?.(value.id) ?? '')
            : value.id
    }
    const raw = String(value)
    if (field.valueType === 'MULTI_TEXT') {
        return raw
            .split(',')
            .filter(Boolean)
            .map(
                (code) =>
                    field.options?.find((item) => item.code === code)
                        ?.displayName ??
                    context?.resolveDisplayName?.(code) ??
                    code
            )
            .join(', ')
    }
    const option = field.options?.find((item) => item.code === raw)
    return option?.displayName ?? context?.resolveDisplayName?.(raw) ?? raw
}

/** Direct-download fallback for values that never got tracker-scoped URLs. */
const fileResourceFallbackUrl = (id: string) =>
    `/api/fileResources/${encodeURIComponent(id)}/data`

const toFileValue = (value: WorkingListRawValue): WorkingListFileValue =>
    isWorkingListFileValue(value)
        ? value
        : { id: String(value), url: fileResourceFallbackUrl(String(value)) }

export const textDisplay = (input: {
    valueType: Dhis2ValueType
    value: WorkingListRawValue
    field: WorkingListField
    context?: CellFormattingContext
}): CellDisplayValue => {
    const { valueType, value, field, context } = input
    if (value === undefined || value === null || value === '') {
        return { kind: 'empty', text: '' }
    }
    if (valueType === 'FILE_RESOURCE') {
        const file = toFileValue(value)
        const name = context?.resolveFileResourceName?.(file.id)
        // Capture parity: a file whose resource name cannot be resolved
        // renders as an empty cell instead of a dead link.
        return name
            ? { kind: 'file', text: name, href: file.url }
            : { kind: 'empty', text: '' }
    }
    if (valueType === 'IMAGE') {
        const file = toFileValue(value)
        return {
            kind: 'image',
            alt: '',
            href: file.url,
            previewHref: file.previewUrl ?? file.url,
        }
    }
    const text = formatText(value, field, context)
    if (!text) {
        return { kind: 'empty', text: '' }
    }
    if (valueType === 'URL') {
        try {
            const url = new URL(text)
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                return { kind: 'link', text, href: url.toString() }
            }
        } catch {
            return { kind: 'text', text }
        }
    }
    if (valueType === 'ORGANISATION_UNIT') {
        return {
            kind: 'reference',
            text,
            id: String(value),
            referenceType: 'organisationUnit',
        }
    }
    if (valueType === 'COORDINATE') {
        try {
            const coordinate = z
                .tuple([z.number().finite(), z.number().finite()])
                .safeParse(JSON.parse(String(value)))
            if (coordinate.success) {
                const [longitude, latitude] = coordinate.data
                return {
                    kind: 'coordinate',
                    text,
                    latitude,
                    longitude,
                }
            }
        } catch {
            return { kind: 'text', text }
        }
    }
    return { kind: 'text', text }
}

const rawValueType = (value: WorkingListRawValue) => {
    if (value === undefined) {
        return 'undefined'
    }
    if (
        value === null ||
        isWorkingListFileValue(value) ||
        isWorkingListUserValue(value)
    ) {
        return 'object'
    }
    if (z.number().safeParse(value).success) {
        return 'number'
    }
    if (z.boolean().safeParse(value).success) {
        return 'boolean'
    }
    return 'string'
}

const parseText = (value: WorkingListRawValue) => {
    const result = z.string().safeParse(value)
    if (!result.success) {
        throw new ValueParseError(
            'Expected a string value, received {{type}}',
            {
                type: rawValueType(value),
            }
        )
    }
    return result.data
}

export const UID_PATTERN = /^[A-Za-z][A-Za-z0-9]{10}$/

export const parseDhis2Uid = (
    value: WorkingListRawValue,
    valueType: Dhis2ValueType
) => {
    const parsed = parseText(value)
    if (!UID_PATTERN.test(parsed)) {
        throw new ValueParseError('{{valueType}} requires a DHIS2 UID', {
            valueType,
        })
    }
    return parsed
}

const isValidGregorianDate = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) {
        return false
    }
    const [, year, month, day] = match.map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    )
}

export const isValidTime = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/)
    if (!match) {
        return false
    }
    const [, hours, minutes, seconds = '0'] = match
    return Number(hours) < 24 && Number(minutes) < 60 && Number(seconds) < 60
}

const parseIsoDateTimeParts = (value: string) =>
    value.match(
        /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)(?:Z|[+-]\d{2}:\d{2})?$/
    )

const isValidIsoDateTime = (value: string) => {
    const match = parseIsoDateTimeParts(value)
    return Boolean(
        match && isValidGregorianDate(match[1]) && isValidTime(match[2])
    )
}

export const isValidEditorDate = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return Boolean(
        match &&
        Number(match[2]) >= 1 &&
        Number(match[2]) <= 13 &&
        Number(match[3]) >= 1 &&
        Number(match[3]) <= 32
    )
}

export const parseDateValue = (
    valueType: 'AGE' | 'DATE' | 'DATETIME',
    value: WorkingListRawValue
) => {
    const parsed = parseText(value)
    if (valueType === 'DATE' || valueType === 'AGE') {
        if (
            !isValidGregorianDate(parsed) &&
            !(valueType === 'DATE' && isValidIsoDateTime(parsed))
        ) {
            throw new ValueParseError(
                '{{valueType}} requires a valid YYYY-MM-DD date',
                { valueType }
            )
        }
        return parsed
    }
    if (!isValidIsoDateTime(parsed)) {
        throw new ValueParseError('DATETIME requires a valid ISO date and time')
    }
    return parsed
}

export const parseTimeValue = (value: WorkingListRawValue) => {
    const parsed = parseText(value)
    if (!isValidTime(parsed)) {
        // No colon in the message: i18next treats ':' as a namespace separator.
        throw new ValueParseError(
            'TIME requires a 24-hour time, optionally with seconds'
        )
    }
    return parsed
}

export const parseTextValue = (
    valueType: Dhis2ValueType,
    value: WorkingListRawValue
) => {
    const parsed = parseText(value)
    switch (valueType) {
        case 'LETTER':
            if ([...parsed].length !== 1) {
                throw new ValueParseError(
                    'LETTER requires exactly one character'
                )
            }
            break
        case 'EMAIL':
            if (!z.email().safeParse(parsed).success) {
                throw new ValueParseError(
                    'EMAIL contains an invalid email address'
                )
            }
            break
        case 'URL': {
            try {
                const url = new URL(parsed)
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    throw new Error('Unsupported URL protocol')
                }
            } catch {
                throw new ValueParseError('URL contains an invalid HTTP(S) URL')
            }
            break
        }
        case 'COORDINATE': {
            let coordinateInput: unknown
            try {
                coordinateInput = JSON.parse(parsed)
            } catch {
                throw new ValueParseError('COORDINATE is not valid JSON')
            }
            const coordinate = z
                .tuple([z.number().finite(), z.number().finite()])
                .safeParse(coordinateInput)
            if (
                !coordinate.success ||
                Math.abs(coordinate.data[0]) > 180 ||
                Math.abs(coordinate.data[1]) > 90
            ) {
                throw new ValueParseError(
                    'COORDINATE requires [longitude, latitude]'
                )
            }
            break
        }
        case 'FILE_RESOURCE':
        case 'IMAGE':
        case 'ORGANISATION_UNIT':
        case 'REFERENCE':
        case 'TRACKER_ASSOCIATE':
            parseDhis2Uid(parsed, valueType)
            break
        case 'MULTI_TEXT':
            if (
                parsed !== '' &&
                parsed.split(',').some((entry) => entry.length === 0)
            ) {
                throw new ValueParseError(
                    'MULTI_TEXT contains an empty option code'
                )
            }
            break
        case 'GEOJSON': {
            let geoJson: unknown
            try {
                geoJson = JSON.parse(parsed)
            } catch {
                throw new ValueParseError('GEOJSON is not valid JSON')
            }
            if (!z.record(z.string(), z.json()).safeParse(geoJson).success) {
                throw new ValueParseError('GEOJSON requires an object')
            }
            break
        }
    }
    return parsed
}
