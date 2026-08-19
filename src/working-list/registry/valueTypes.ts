import { z } from 'zod'
import type { WorkingListCapabilities } from '../api/capabilities'
import type { SavedValueFilter } from '../api/schemas'
import type {
    AppliedFilter,
    Dhis2ValueType,
    FilterOperator,
    FilterValue,
    RelativeDatePeriod,
    WorkingListField,
} from '../domain/model'
import { AppliedFilterSchema, FilterValueSchema } from '../domain/schemas'
import { getSystemFilterOperators, validateSystemFilter } from './systemFilters'

export type FilterEditorKind =
    | 'text'
    | 'numberRange'
    | 'timeRange'
    | 'dateRange'
    | 'boolean'
    | 'options'
    | 'organisationUnit'
    | 'trueOnly'
    | 'displayOnly'

export interface FilterSerializationContext {
    toApiDate?: (value: string) => string
    /** Throws when an editor date is not valid in the configured calendar. */
    validateDate?: (value: string) => void
    /** ISO date used by the Gregorian relative-date fallback. */
    today?: string
    resolveRelativeDate?: (value: {
        period?: RelativeDatePeriod
        startBuffer?: number
        endBuffer?: number
    }) => { start?: string; end?: string }
}

export interface FilterParsingContext {
    fromApiDate?: (value: string) => string
}

export interface CellFormattingContext {
    locale?: string
    trueLabel?: string
    falseLabel?: string
    resolveDisplayName?: (id: string) => string | undefined
    formatDate?: (value: string, valueType: Dhis2ValueType) => string
    formatNumber?: (value: number, valueType: Dhis2ValueType) => string
}

export type CellDisplayValue =
    | { kind: 'empty'; text: '' }
    | { kind: 'text'; text: string }
    | { kind: 'link'; text: string; href: string }
    | {
          kind: 'file'
          text: string
          resource: { resource: 'fileResources'; id: string }
      }
    | {
          kind: 'image'
          alt: string
          resource: { resource: 'fileResources'; id: string }
      }
    | {
          kind: 'coordinate'
          text: string
          latitude: number
          longitude: number
      }
    | {
          kind: 'reference'
          text: string
          id: string
          referenceType: 'organisationUnit'
      }

export interface ValueTypeDefinition {
    valueType: Dhis2ValueType
    editor: FilterEditorKind
    parseServerValue(value: unknown): unknown
    parseEditorValue(value: unknown): FilterValue
    format(
        value: unknown,
        field: WorkingListField,
        context?: CellFormattingContext
    ): string
    display(
        value: unknown,
        field: WorkingListField,
        context?: CellFormattingContext
    ): CellDisplayValue
    operators(
        field: WorkingListField,
        capabilities: WorkingListCapabilities
    ): FilterOperator[]
    serializeQuery(
        filter: AppliedFilter,
        context?: FilterSerializationContext
    ): string
    serializeSaved(
        filter: AppliedFilter,
        context?: FilterSerializationContext
    ): Omit<SavedValueFilter, 'attribute' | 'dataItem'>
    parseSaved(
        filter: SavedValueFilter,
        context?: FilterParsingContext
    ): FilterValue
}

const interpolateTemplate = (
    template: string,
    values?: Record<string, string | number>
) =>
    template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
        values && key in values ? String(values[key]) : match
    )

/**
 * A server value failed its value-type contract. Carries the untranslated
 * message template and values so consumers can localize the message.
 */
export class ValueParseError extends Error {
    readonly template: string
    readonly values?: Record<string, string | number>

    constructor(template: string, values?: Record<string, string | number>) {
        super(interpolateTemplate(template, values))
        this.name = 'ValueParseError'
        this.template = template
        this.values = values
    }
}

const escapeFilterValue = (value: string) =>
    value.replaceAll('/', '//').replaceAll(':', '/:').replaceAll(',', '/,')

const operatorToApi = (operator: FilterOperator) => {
    const operators: Partial<Record<FilterOperator, string>> = {
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
    }
    const result = operators[operator]
    if (!result) {
        throw new Error(`Filter operator ${operator} has no scalar API mapping`)
    }
    return result
}

const apiToOperator = (operator: string): FilterOperator => {
    const operators: Record<string, FilterOperator> = {
        like: 'like',
        sw: 'startsWith',
        ew: 'endsWith',
        eq: 'equals',
        ge: 'greaterThanOrEqual',
        le: 'lessThanOrEqual',
        in: 'in',
    }
    const result = operators[operator]
    if (!result) {
        throw new Error(`Unknown saved-list filter operator: ${operator}`)
    }
    return result
}

const emptyOperators = (capabilities: WorkingListCapabilities) =>
    capabilities.emptyValueFilters
        ? (['empty', 'notEmpty'] as FilterOperator[])
        : []

const ensureEmptyValue = (filter: AppliedFilter) => {
    if (filter.value.kind !== 'empty') {
        return undefined
    }
    return filter.value.isEmpty ? 'null' : '!null'
}

const serializeEmptySaved = (filter: AppliedFilter) => {
    if (filter.value.kind !== 'empty') {
        return undefined
    }
    return { null: filter.value.isEmpty }
}

const parseEmptySaved = (filter: SavedValueFilter): FilterValue | undefined =>
    typeof filter.null === 'boolean'
        ? { kind: 'empty', isEmpty: filter.null }
        : undefined

const textOperators = (
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

const formatText = (
    value: unknown,
    field: WorkingListField,
    context?: CellFormattingContext
) => {
    if (value === undefined || value === null || value === '') {
        return ''
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

const textDisplay = (input: {
    valueType: Dhis2ValueType
    value: unknown
    field: WorkingListField
    context?: CellFormattingContext
}): CellDisplayValue => {
    const { valueType, value, field, context } = input
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
    if (valueType === 'FILE_RESOURCE') {
        return {
            kind: 'file',
            text,
            resource: { resource: 'fileResources', id: String(value) },
        }
    }
    if (valueType === 'IMAGE') {
        return {
            kind: 'image',
            alt: text,
            resource: { resource: 'fileResources', id: String(value) },
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
            const coordinate = JSON.parse(String(value)) as unknown
            if (
                Array.isArray(coordinate) &&
                coordinate.length === 2 &&
                coordinate.every(
                    (entry) =>
                        typeof entry === 'number' && Number.isFinite(entry)
                )
            ) {
                const [longitude, latitude] = coordinate
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

const parseText = (value: unknown) => {
    if (typeof value !== 'string') {
        throw new ValueParseError(
            'Expected a string value, received {{type}}',
            {
                type: typeof value,
            }
        )
    }
    return value
}

const UID_PATTERN = /^[A-Za-z][A-Za-z0-9]{10}$/

const parseDhis2Uid = (value: unknown, valueType: Dhis2ValueType) => {
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

const isValidTime = (value: string) => {
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

const isValidEditorDate = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return Boolean(
        match &&
        Number(match[2]) >= 1 &&
        Number(match[2]) <= 13 &&
        Number(match[3]) >= 1 &&
        Number(match[3]) <= 32
    )
}

const parseDateValue = (
    valueType: 'AGE' | 'DATE' | 'DATETIME',
    value: unknown
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

const parseTimeValue = (value: unknown) => {
    const parsed = parseText(value)
    if (!isValidTime(parsed)) {
        // No colon in the message: i18next treats ':' as a namespace separator.
        throw new ValueParseError(
            'TIME requires a 24-hour time, optionally with seconds'
        )
    }
    return parsed
}

const parseTextValue = (valueType: Dhis2ValueType, value: unknown) => {
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
            let coordinate: unknown
            try {
                coordinate = JSON.parse(parsed)
            } catch {
                throw new ValueParseError('COORDINATE is not valid JSON')
            }
            if (
                !Array.isArray(coordinate) ||
                coordinate.length !== 2 ||
                coordinate.some(
                    (entry) =>
                        typeof entry !== 'number' || !Number.isFinite(entry)
                ) ||
                Math.abs(coordinate[0]) > 180 ||
                Math.abs(coordinate[1]) > 90
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
            if (!geoJson || typeof geoJson !== 'object') {
                throw new ValueParseError('GEOJSON requires an object')
            }
            break
        }
    }
    return parsed
}

const textDefinition = (valueType: Dhis2ValueType): ValueTypeDefinition => ({
    valueType,
    editor: 'text',
    parseServerValue(value) {
        return parseTextValue(valueType, value)
    },
    parseEditorValue(value) {
        const parsed = FilterValueSchema.parse(value)
        if (
            parsed.kind !== 'text' &&
            parsed.kind !== 'options' &&
            parsed.kind !== 'empty'
        ) {
            throw new Error(`${valueType} expects text, options, or empty`)
        }
        return parsed
    },
    format: formatText,
    display(value, field, context) {
        return textDisplay({ valueType, value, field, context })
    },
    operators(field, capabilities) {
        if (
            ['COORDINATE', 'FILE_RESOURCE', 'IMAGE', 'URL'].includes(valueType)
        ) {
            return emptyOperators(capabilities)
        }
        return textOperators(field, capabilities)
    },
    serializeQuery(filter) {
        const empty = ensureEmptyValue(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind === 'options') {
            return `in:${filter.value.values.map(escapeFilterValue).join(';')}`
        }
        if (filter.value.kind !== 'text') {
            throw new Error(`${valueType} expects a text or options filter`)
        }
        return `${operatorToApi(filter.operator)}:${escapeFilterValue(filter.value.value)}`
    },
    serializeSaved(filter) {
        const empty = serializeEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind === 'options') {
            return { in: filter.value.values }
        }
        if (filter.value.kind !== 'text') {
            throw new Error(`${valueType} expects a text or options filter`)
        }
        return { [operatorToApi(filter.operator)]: filter.value.value }
    },
    parseSaved(filter) {
        const empty = parseEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.in) {
            return FilterValueSchema.parse({
                kind: 'options',
                values: filter.in,
            })
        }
        const entry = ['eq', 'sw', 'ew', 'like']
            .map((key) => [key, filter[key as keyof SavedValueFilter]] as const)
            .find(([, value]) => typeof value === 'string')
        if (!entry) {
            throw new Error(`Saved ${valueType} filter has no value`)
        }
        apiToOperator(entry[0])
        return FilterValueSchema.parse({
            kind: 'text',
            value: entry[1] as string,
        })
    },
})

const validateNumberForValueType = (
    value: number,
    valueType: Dhis2ValueType
) => {
    const integerTypes = new Set<Dhis2ValueType>([
        'INTEGER',
        'INTEGER_NEGATIVE',
        'INTEGER_POSITIVE',
        'INTEGER_ZERO_OR_POSITIVE',
    ])
    if (integerTypes.has(valueType) && !Number.isInteger(value)) {
        throw new ValueParseError('{{valueType}} requires an integer', {
            valueType,
        })
    }
    if (valueType === 'INTEGER_POSITIVE' && value <= 0) {
        throw new ValueParseError(
            'INTEGER_POSITIVE requires a value greater than zero'
        )
    }
    if (valueType === 'INTEGER_NEGATIVE' && value >= 0) {
        throw new ValueParseError(
            'INTEGER_NEGATIVE requires a value less than zero'
        )
    }
    if (valueType === 'INTEGER_ZERO_OR_POSITIVE' && value < 0) {
        throw new ValueParseError(
            'INTEGER_ZERO_OR_POSITIVE requires a value of zero or greater'
        )
    }
    if (valueType === 'UNIT_INTERVAL' && (value < 0 || value > 1)) {
        throw new ValueParseError(
            'UNIT_INTERVAL requires a value from zero to one'
        )
    }
    if (valueType === 'PERCENTAGE' && (value < 0 || value > 100)) {
        throw new ValueParseError(
            'PERCENTAGE requires a value from zero to 100'
        )
    }
}

const parseNumberServerValue = (valueType: Dhis2ValueType, value: unknown) => {
    if (typeof value === 'string' && value.trim() === '') {
        throw new ValueParseError('Expected a finite {{valueType}} value', {
            valueType,
        })
    }
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed)) {
        throw new ValueParseError('Expected a finite {{valueType}} value', {
            valueType,
        })
    }
    validateNumberForValueType(parsed, valueType)
    return parsed
}

const parseNumericEditorValue = (valueType: Dhis2ValueType, value: unknown) => {
    const parsed = FilterValueSchema.parse(value)
    if (parsed.kind !== 'numberRange' && parsed.kind !== 'empty') {
        throw new Error(`${valueType} expects a numeric range or empty value`)
    }
    if (parsed.kind === 'numberRange') {
        if (
            parsed.min !== undefined &&
            parsed.max !== undefined &&
            parsed.min > parsed.max
        ) {
            throw new Error('A numeric range minimum cannot exceed its maximum')
        }
        if (parsed.min !== undefined) {
            validateNumberForValueType(parsed.min, valueType)
        }
        if (parsed.max !== undefined) {
            validateNumberForValueType(parsed.max, valueType)
        }
    }
    return parsed
}

const numericDefinition = (valueType: Dhis2ValueType): ValueTypeDefinition => ({
    valueType,
    editor: 'numberRange',
    parseServerValue(value) {
        return parseNumberServerValue(valueType, value)
    },
    parseEditorValue(value) {
        return parseNumericEditorValue(valueType, value)
    },
    format(value, _field, context) {
        const parsed = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(parsed)) {
            return ''
        }
        const formatted =
            context?.formatNumber?.(parsed, valueType) ??
            new Intl.NumberFormat(context?.locale).format(parsed)
        return valueType === 'PERCENTAGE' ? `${formatted}%` : formatted
    },
    display(value, field, context) {
        const text = this.format(value, field, context)
        return text ? { kind: 'text', text } : { kind: 'empty', text: '' }
    },
    operators(_field, capabilities) {
        return ['range', ...emptyOperators(capabilities)]
    },
    serializeQuery(filter) {
        const empty = ensureEmptyValue(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'numberRange') {
            throw new Error(`${valueType} expects a numeric range filter`)
        }
        return [
            filter.value.min !== undefined
                ? `ge:${filter.value.min}`
                : undefined,
            filter.value.max !== undefined
                ? `le:${filter.value.max}`
                : undefined,
        ]
            .filter(Boolean)
            .join(':')
    },
    serializeSaved(filter) {
        const empty = serializeEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'numberRange') {
            throw new Error(`${valueType} expects a numeric range filter`)
        }
        return {
            ge: filter.value.min?.toString(),
            le: filter.value.max?.toString(),
        }
    },
    parseSaved(filter) {
        const empty = parseEmptySaved(filter)
        if (empty) {
            return empty
        }
        const value = {
            kind: 'numberRange' as const,
            min:
                filter.ge !== undefined
                    ? parseNumberServerValue(valueType, filter.ge)
                    : undefined,
            max:
                filter.le !== undefined
                    ? parseNumberServerValue(valueType, filter.le)
                    : undefined,
        }
        return parseNumericEditorValue(valueType, value)
    },
})

const defaultToApiDate = (value: string) => value.slice(0, 10)

const addUtcDays = (date: Date, days: number) => {
    const result = new Date(date)
    result.setUTCDate(result.getUTCDate() + days)
    return result
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

const defaultResolveRelativeDate = (
    value: {
        period?: RelativeDatePeriod
        startBuffer?: number
        endBuffer?: number
    },
    todayValue?: string
) => {
    const today = new Date(
        `${(todayValue ?? isoDate(new Date())).slice(0, 10)}T12:00:00Z`
    )
    if (value.startBuffer !== undefined || value.endBuffer !== undefined) {
        return {
            start:
                value.startBuffer !== undefined
                    ? isoDate(addUtcDays(today, value.startBuffer))
                    : undefined,
            end:
                value.endBuffer !== undefined
                    ? isoDate(addUtcDays(today, value.endBuffer))
                    : undefined,
        }
    }
    const startOfWeek = addUtcDays(today, -today.getUTCDay())
    switch (value.period) {
        case 'TODAY':
            return { start: isoDate(today), end: isoDate(today) }
        case 'THIS_WEEK':
            return {
                start: isoDate(startOfWeek),
                end: isoDate(addUtcDays(startOfWeek, 6)),
            }
        case 'LAST_WEEK': {
            const start = addUtcDays(startOfWeek, -7)
            return { start: isoDate(start), end: isoDate(addUtcDays(start, 6)) }
        }
        case 'THIS_MONTH':
            return {
                start: isoDate(
                    new Date(
                        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
                    )
                ),
                end: isoDate(
                    new Date(
                        Date.UTC(
                            today.getUTCFullYear(),
                            today.getUTCMonth() + 1,
                            0
                        )
                    )
                ),
            }
        case 'LAST_MONTH':
            return {
                start: isoDate(
                    new Date(
                        Date.UTC(
                            today.getUTCFullYear(),
                            today.getUTCMonth() - 1,
                            1
                        )
                    )
                ),
                end: isoDate(
                    new Date(
                        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)
                    )
                ),
            }
        case 'LAST_3_MONTHS':
            return {
                start: isoDate(
                    new Date(
                        Date.UTC(
                            today.getUTCFullYear(),
                            today.getUTCMonth() - 3,
                            1
                        )
                    )
                ),
                end: isoDate(
                    new Date(
                        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)
                    )
                ),
            }
        case 'THIS_YEAR':
            return {
                start: `${today.getUTCFullYear()}-01-01`,
                end: `${today.getUTCFullYear()}-12-31`,
            }
        default:
            throw new Error(`Unsupported relative date period: ${value.period}`)
    }
}

const parseDateEditorValue = (
    valueType: 'AGE' | 'DATE' | 'DATETIME',
    value: unknown
) => {
    const parsed = FilterValueSchema.parse(value)
    if (parsed.kind !== 'dateRange' && parsed.kind !== 'empty') {
        throw new Error(`${valueType} expects a date range or empty value`)
    }
    if (parsed.kind === 'dateRange' && parsed.mode === 'absolute') {
        for (const boundary of [parsed.start, parsed.end]) {
            if (boundary !== undefined && !isValidEditorDate(boundary)) {
                throw new Error('An absolute date boundary requires YYYY-MM-DD')
            }
        }
        if (parsed.start && parsed.end && parsed.start > parsed.end) {
            throw new Error(
                'An absolute date range start cannot exceed its end'
            )
        }
    }
    return parsed
}

const dateDefinition = (
    valueType: 'AGE' | 'DATE' | 'DATETIME'
): ValueTypeDefinition => ({
    valueType,
    editor: 'dateRange',
    parseServerValue(value) {
        return parseDateValue(valueType, value)
    },
    parseEditorValue(value) {
        return parseDateEditorValue(valueType, value)
    },
    format(value, _field, context) {
        if (typeof value !== 'string' || !value) {
            return ''
        }
        const transformed = context?.formatDate?.(value, valueType)
        if (transformed !== undefined) {
            return transformed
        }
        const date = new Date(
            valueType === 'DATE' || valueType === 'AGE'
                ? `${value.slice(0, 10)}T00:00:00Z`
                : value
        )
        if (Number.isNaN(date.getTime())) {
            return value
        }
        const options: Intl.DateTimeFormatOptions =
            valueType === 'DATETIME'
                ? { dateStyle: 'medium', timeStyle: 'short' }
                : { dateStyle: 'medium', timeZone: 'UTC' }
        return new Intl.DateTimeFormat(context?.locale, options).format(date)
    },
    display(value, field, context) {
        const text = this.format(value, field, context)
        return text ? { kind: 'text', text } : { kind: 'empty', text: '' }
    },
    operators(_field, capabilities) {
        return ['range', ...emptyOperators(capabilities)]
    },
    serializeQuery(filter, context) {
        const empty = ensureEmptyValue(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'dateRange') {
            throw new Error(`${valueType} expects a date range filter`)
        }
        const toApiDate = context?.toApiDate ?? defaultToApiDate
        const range =
            filter.value.mode === 'absolute'
                ? { start: filter.value.start, end: filter.value.end }
                : (context?.resolveRelativeDate?.(filter.value) ??
                  defaultResolveRelativeDate(filter.value, context?.today))
        return [
            range.start
                ? `ge:${escapeFilterValue(toApiDate(range.start))}`
                : undefined,
            range.end
                ? `le:${escapeFilterValue(toApiDate(range.end))}`
                : undefined,
        ]
            .filter(Boolean)
            .join(':')
    },
    serializeSaved(filter, context) {
        const empty = serializeEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'dateRange') {
            throw new Error(`${valueType} expects a date range filter`)
        }
        const toApiDate = context?.toApiDate ?? defaultToApiDate
        return {
            dateFilter:
                filter.value.mode === 'absolute'
                    ? {
                          type: 'ABSOLUTE',
                          startDate: filter.value.start
                              ? toApiDate(filter.value.start)
                              : undefined,
                          endDate: filter.value.end
                              ? toApiDate(filter.value.end)
                              : undefined,
                      }
                    : {
                          type: 'RELATIVE',
                          period: filter.value.period,
                          startBuffer: filter.value.startBuffer,
                          endBuffer: filter.value.endBuffer,
                      },
        }
    },
    parseSaved(filter, context) {
        const empty = parseEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (!filter.dateFilter) {
            throw new Error(`Saved ${valueType} filter has no dateFilter`)
        }
        return parseDateEditorValue(
            valueType,
            filter.dateFilter.type === 'ABSOLUTE'
                ? {
                      kind: 'dateRange',
                      mode: 'absolute',
                      start: filter.dateFilter.startDate
                          ? (context?.fromApiDate?.(
                                filter.dateFilter.startDate
                            ) ?? filter.dateFilter.startDate)
                          : undefined,
                      end: filter.dateFilter.endDate
                          ? (context?.fromApiDate?.(
                                filter.dateFilter.endDate
                            ) ?? filter.dateFilter.endDate)
                          : undefined,
                  }
                : {
                      kind: 'dateRange',
                      mode: 'relative',
                      period: filter.dateFilter.period,
                      startBuffer: filter.dateFilter.startBuffer,
                      endBuffer: filter.dateFilter.endBuffer,
                  }
        )
    },
})

const parseTimeEditorValue = (value: unknown) => {
    const parsed = FilterValueSchema.parse(value)
    if (parsed.kind !== 'timeRange' && parsed.kind !== 'empty') {
        throw new Error('TIME expects a time range or empty value')
    }
    if (parsed.kind === 'timeRange') {
        for (const boundary of [parsed.min, parsed.max]) {
            if (boundary !== undefined && !isValidTime(boundary)) {
                throw new Error('A time boundary requires HH:mm')
            }
        }
        if (parsed.min && parsed.max && parsed.min > parsed.max) {
            throw new Error('A time range minimum cannot exceed its maximum')
        }
    }
    return parsed
}

const timeDefinition: ValueTypeDefinition = {
    ...textDefinition('TIME'),
    editor: 'timeRange',
    parseServerValue: parseTimeValue,
    parseEditorValue: parseTimeEditorValue,
    operators(_field, capabilities) {
        return ['range', ...emptyOperators(capabilities)]
    },
    serializeQuery(filter) {
        const empty = ensureEmptyValue(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'timeRange') {
            throw new Error('TIME expects a time range filter')
        }
        return [
            filter.value.min
                ? `ge:${escapeFilterValue(filter.value.min)}`
                : undefined,
            filter.value.max
                ? `le:${escapeFilterValue(filter.value.max)}`
                : undefined,
        ]
            .filter(Boolean)
            .join(':')
    },
    serializeSaved(filter) {
        const empty = serializeEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'timeRange') {
            throw new Error('TIME expects a time range filter')
        }
        return { ge: filter.value.min, le: filter.value.max }
    },
    parseSaved(filter) {
        const empty = parseEmptySaved(filter)
        if (empty) {
            return empty
        }
        return parseTimeEditorValue({
            kind: 'timeRange',
            min: filter.ge,
            max: filter.le,
        })
    },
}

const booleanDefinition: ValueTypeDefinition = {
    valueType: 'BOOLEAN',
    editor: 'boolean',
    parseServerValue(value) {
        if (value === true || value === 'true') {
            return true
        }
        if (value === false || value === 'false') {
            return false
        }
        throw new ValueParseError('Expected a boolean value')
    },
    parseEditorValue(value) {
        const parsed = FilterValueSchema.parse(value)
        if (parsed.kind !== 'boolean' && parsed.kind !== 'empty') {
            throw new Error('BOOLEAN expects a boolean or empty value')
        }
        return parsed
    },
    format(value, _field, context) {
        if (value === true || value === 'true') {
            return context?.trueLabel ?? 'Yes'
        }
        if (value === false || value === 'false') {
            return context?.falseLabel ?? 'No'
        }
        return ''
    },
    display(value, field, context) {
        const text = this.format(value, field, context)
        return text ? { kind: 'text', text } : { kind: 'empty', text: '' }
    },
    operators(_field, capabilities) {
        return ['in', ...emptyOperators(capabilities)]
    },
    serializeQuery(filter) {
        const empty = ensureEmptyValue(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'boolean') {
            throw new Error('BOOLEAN expects a boolean filter')
        }
        const values = filter.value.values.map(String)
        return values.length === 1
            ? `eq:${values[0]}`
            : `in:${values.join(';')}`
    },
    serializeSaved(filter) {
        const empty = serializeEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'boolean') {
            throw new Error('BOOLEAN expects a boolean filter')
        }
        return { in: filter.value.values.map(String) }
    },
    parseSaved(filter) {
        const empty = parseEmptySaved(filter)
        if (empty) {
            return empty
        }
        const values = filter.in ?? (filter.eq ? [filter.eq] : undefined)
        if (!values?.every((value) => value === 'true' || value === 'false')) {
            throw new Error('Saved BOOLEAN filter contains a non-boolean value')
        }
        return {
            kind: 'boolean',
            values: values.map((value) => value === 'true'),
        }
    },
}

const trueOnlyDefinition: ValueTypeDefinition = {
    ...booleanDefinition,
    valueType: 'TRUE_ONLY',
    editor: 'trueOnly',
    parseServerValue(value) {
        if (value === true || value === 'true') {
            return true
        }
        throw new ValueParseError('TRUE_ONLY accepts only true')
    },
    parseEditorValue(value) {
        const parsed = FilterValueSchema.parse(value)
        if (parsed.kind !== 'trueOnly' && parsed.kind !== 'empty') {
            throw new Error('TRUE_ONLY expects true or empty')
        }
        return parsed
    },
    operators(_field, capabilities) {
        return ['equals', ...emptyOperators(capabilities)]
    },
    serializeQuery(filter) {
        const empty = ensureEmptyValue(filter)
        return empty ?? 'eq:true'
    },
    serializeSaved(filter) {
        const empty = serializeEmptySaved(filter)
        return empty ?? { eq: 'true' }
    },
    parseSaved(filter) {
        const empty = parseEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.eq !== 'true') {
            throw new Error('Saved TRUE_ONLY filter requires eq:true')
        }
        return { kind: 'trueOnly', value: true }
    },
}

const organisationUnitDefinition: ValueTypeDefinition = {
    ...textDefinition('ORGANISATION_UNIT'),
    editor: 'organisationUnit',
    parseServerValue(value) {
        return parseDhis2Uid(value, 'ORGANISATION_UNIT')
    },
    parseEditorValue(value) {
        const parsed = FilterValueSchema.parse(value)
        if (parsed.kind !== 'organisationUnit' && parsed.kind !== 'empty') {
            throw new Error(
                'ORGANISATION_UNIT expects an organisation unit or empty value'
            )
        }
        if (
            parsed.kind === 'organisationUnit' &&
            !UID_PATTERN.test(parsed.id)
        ) {
            throw new Error('ORGANISATION_UNIT requires a DHIS2 UID')
        }
        return parsed
    },
    operators(_field, capabilities) {
        return ['equals', ...emptyOperators(capabilities)]
    },
    serializeQuery(filter) {
        const empty = ensureEmptyValue(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'organisationUnit') {
            throw new Error(
                'ORGANISATION_UNIT expects an organisation unit filter'
            )
        }
        return `eq:${escapeFilterValue(filter.value.id)}`
    },
    serializeSaved(filter) {
        const empty = serializeEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'organisationUnit') {
            throw new Error(
                'ORGANISATION_UNIT expects an organisation unit filter'
            )
        }
        return { eq: filter.value.id }
    },
    parseSaved(filter) {
        const empty = parseEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (!filter.eq) {
            throw new Error('Saved organisation unit filter has no eq value')
        }
        parseDhis2Uid(filter.eq, 'ORGANISATION_UNIT')
        return { kind: 'organisationUnit', id: filter.eq }
    },
}

const displayOnlyDefinition = (
    valueType: Dhis2ValueType
): ValueTypeDefinition => ({
    ...textDefinition(valueType),
    editor: 'displayOnly',
    operators: () => [],
    serializeQuery() {
        throw new Error(`${valueType} is display-only`)
    },
    serializeSaved() {
        throw new Error(`${valueType} is display-only`)
    },
    parseSaved() {
        throw new Error(`${valueType} is display-only`)
    },
})

const numericTypes: Dhis2ValueType[] = [
    'NUMBER',
    'UNIT_INTERVAL',
    'PERCENTAGE',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
]

const textTypes: Dhis2ValueType[] = [
    'TEXT',
    'LONG_TEXT',
    'LETTER',
    'PHONE_NUMBER',
    'EMAIL',
    'URL',
    'USERNAME',
    'COORDINATE',
    'FILE_RESOURCE',
    'IMAGE',
    'MULTI_TEXT',
]

const definitions = new Map<Dhis2ValueType, ValueTypeDefinition>()
textTypes.forEach((type) => definitions.set(type, textDefinition(type)))
numericTypes.forEach((type) => definitions.set(type, numericDefinition(type)))
definitions.set('AGE', dateDefinition('AGE'))
definitions.set('DATE', dateDefinition('DATE'))
definitions.set('DATETIME', dateDefinition('DATETIME'))
definitions.set('TIME', timeDefinition)
definitions.set('BOOLEAN', booleanDefinition)
definitions.set('TRUE_ONLY', trueOnlyDefinition)
definitions.set('ORGANISATION_UNIT', organisationUnitDefinition)
definitions.set('GEOJSON', displayOnlyDefinition('GEOJSON'))
definitions.set('REFERENCE', displayOnlyDefinition('REFERENCE'))
definitions.set('TRACKER_ASSOCIATE', displayOnlyDefinition('TRACKER_ASSOCIATE'))

export const valueTypeRegistry: ReadonlyMap<
    Dhis2ValueType,
    ValueTypeDefinition
> = definitions

export const getValueTypeDefinition = (
    valueType: Dhis2ValueType
): ValueTypeDefinition => {
    const definition = valueTypeRegistry.get(valueType)
    if (!definition) {
        throw new Error(`No value-type definition registered for ${valueType}`)
    }
    return definition
}

export const getFilterEditorKind = (
    field: WorkingListField
): FilterEditorKind =>
    field.optionSetId || field.options?.length
        ? 'options'
        : getValueTypeDefinition(field.valueType).editor

export const getAllowedFilterOperators = (
    field: WorkingListField,
    capabilities: WorkingListCapabilities
): FilterOperator[] =>
    field.source === 'system'
        ? [...(getSystemFilterOperators(field.id) ?? [])]
        : getValueTypeDefinition(field.valueType).operators(field, capabilities)

export const getCellDisplayValue = (
    value: unknown,
    field: WorkingListField,
    context?: CellFormattingContext
): CellDisplayValue =>
    getValueTypeDefinition(field.valueType).display(value, field, context)

const validateOperatorValuePair = (
    filter: AppliedFilter,
    editor: FilterEditorKind
) => {
    if (filter.operator === 'empty' || filter.operator === 'notEmpty') {
        if (
            filter.value.kind !== 'empty' ||
            filter.value.isEmpty !== (filter.operator === 'empty')
        ) {
            throw new Error(
                `${filter.operator} requires the matching empty filter value`
            )
        }
        return
    }
    const expectedKinds: Partial<
        Record<FilterEditorKind, FilterValue['kind']>
    > = {
        text: 'text',
        numberRange: 'numberRange',
        timeRange: 'timeRange',
        dateRange: 'dateRange',
        boolean: 'boolean',
        options: 'options',
        organisationUnit: 'organisationUnit',
        trueOnly: 'trueOnly',
    }
    const expected = expectedKinds[editor]
    if (!expected || filter.value.kind !== expected) {
        throw new Error(
            `${filter.field.id} requires a ${expected ?? 'supported'} filter value`
        )
    }
}

export const validateAppliedFilter = (
    input: unknown,
    capabilities: WorkingListCapabilities,
    context?: FilterSerializationContext
): AppliedFilter => {
    const filter = AppliedFilterSchema.parse(input) as AppliedFilter
    if (
        !filter.field.filterable ||
        !capabilities.supportsValueTypeFilter(filter.field.valueType)
    ) {
        throw new Error(
            `Field ${filter.field.id} is not filterable on this server`
        )
    }
    if (filter.field.source === 'system') {
        validateSystemFilter(filter)
    } else {
        const definition = getValueTypeDefinition(filter.field.valueType)
        definition.parseEditorValue(filter.value)
        validateOperatorValuePair(filter, getFilterEditorKind(filter.field))
    }
    if (filter.value.kind === 'dateRange' && filter.value.mode === 'absolute') {
        for (const boundary of [filter.value.start, filter.value.end]) {
            if (boundary !== undefined) {
                context?.validateDate?.(boundary)
            }
        }
    }
    const operators = getAllowedFilterOperators(filter.field, capabilities)
    if (!operators.includes(filter.operator)) {
        throw new Error(
            `Operator ${filter.operator} is not allowed for ${filter.field.id}`
        )
    }
    if (
        filter.value.kind === 'text' &&
        capabilities.minimumSearchLength &&
        filter.field.minCharactersToSearch !== undefined &&
        filter.value.value.length < filter.field.minCharactersToSearch
    ) {
        throw new Error(
            `${filter.field.id} requires at least ${filter.field.minCharactersToSearch} characters`
        )
    }
    if (
        filter.value.kind === 'options' &&
        !capabilities.multipleOptionValues &&
        filter.value.values.length > 1
    ) {
        throw new Error(
            `Multiple option values are not supported for ${filter.field.id}`
        )
    }
    if (filter.value.kind === 'options' && filter.field.options) {
        const knownCodes = new Set(
            filter.field.options.map((option) => option.code)
        )
        const unknown = filter.value.values.find(
            (value) => !knownCodes.has(value)
        )
        if (unknown !== undefined) {
            throw new Error(
                `${unknown} is not a known option for ${filter.field.id}`
            )
        }
    }
    return filter
}

export const ValueTypeRegistrySchema = z.custom<
    ReadonlyMap<Dhis2ValueType, ValueTypeDefinition>
>((value) => value instanceof Map)
