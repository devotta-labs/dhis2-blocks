import { z } from 'zod'
import type { Dhis2ValueType, FilterValue } from '../domain/model'
import { FilterValueSchema } from '../domain/schemas'
import type {
    ValueTypeDefinition,
    WorkingListRawValue,
} from './valueTypeContracts'
import { ValueParseError } from './valueTypeContracts'
import {
    apiToOperator,
    emptyOperators,
    ensureEmptyValue,
    escapeFilterValue,
    formatText,
    operatorToApi,
    parseEmptySaved,
    parseTextValue,
    serializeEmptySaved,
    textDisplay,
    textOperators,
} from './valueTypeShared'

export const textDefinition = (
    valueType: Dhis2ValueType
): ValueTypeDefinition => ({
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
        const entries = [
            ['eq', filter.eq],
            ['sw', filter.sw],
            ['ew', filter.ew],
            ['like', filter.like],
        ] as const
        const entry = entries.find(
            ([, value]) => z.string().safeParse(value).success
        )
        if (!entry) {
            throw new Error(`Saved ${valueType} filter has no value`)
        }
        apiToOperator(entry[0])
        return FilterValueSchema.parse({
            kind: 'text',
            value: z.string().parse(entry[1]),
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

const parseNumberServerValue = (
    valueType: Dhis2ValueType,
    value: WorkingListRawValue
) => {
    const stringValue = z.string().safeParse(value)
    if (stringValue.success && stringValue.data.trim() === '') {
        throw new ValueParseError('Expected a finite {{valueType}} value', {
            valueType,
        })
    }
    const numberValue = z.number().safeParse(value)
    const parsed = numberValue.success ? numberValue.data : Number(value)
    if (!Number.isFinite(parsed)) {
        throw new ValueParseError('Expected a finite {{valueType}} value', {
            valueType,
        })
    }
    validateNumberForValueType(parsed, valueType)
    return parsed
}

const parseNumericEditorValue = (
    valueType: Dhis2ValueType,
    value: FilterValue
) => {
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

export const numericDefinition = (
    valueType: Dhis2ValueType
): ValueTypeDefinition => ({
    valueType,
    editor: 'numberRange',
    parseServerValue(value) {
        return parseNumberServerValue(valueType, value)
    },
    parseEditorValue(value) {
        return parseNumericEditorValue(valueType, value)
    },
    format(value, _field, context) {
        const numberValue = z.number().safeParse(value)
        const parsed = numberValue.success ? numberValue.data : Number(value)
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
