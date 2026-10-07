import type { WorkingListCapabilities } from '../api/capabilities'
import type {
    AppliedFilter,
    Dhis2ValueType,
    FilterOperator,
    FilterValue,
    WorkingListField,
} from '../domain/model'
import { AppliedFilterSchema, FilterValueSchema } from '../domain/schemas'
import { dateDefinition, timeDefinition } from './dateTimeValueTypes'
import { getSystemFilterOperators, validateSystemFilter } from './systemFilters'
import { numericDefinition, textDefinition } from './textAndNumericValueTypes'
import type {
    CellDisplayValue,
    CellFormattingContext,
    FilterEditorKind,
    FilterSerializationContext,
    ValueTypeDefinition,
    WorkingListRawValue,
} from './valueTypeContracts'
import { ValueParseError } from './valueTypeContracts'
import {
    UID_PATTERN,
    emptyOperators,
    ensureEmptyValue,
    escapeFilterValue,
    parseDhis2Uid,
    parseEmptySaved,
    serializeEmptySaved,
} from './valueTypeShared'

export * from './valueTypeContracts'

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

const valueTypeRegistry: ReadonlyMap<Dhis2ValueType, ValueTypeDefinition> =
    definitions

export const getValueTypeDefinition = (
    valueType: Dhis2ValueType
): ValueTypeDefinition => {
    const definition = valueTypeRegistry.get(valueType)

    if (!definition) {
        throw new Error(`No value-type definition registered for ${valueType}`)
    }

    return definition
}

const getFilterEditorKind = (field: WorkingListField): FilterEditorKind =>
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
    value: WorkingListRawValue,
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

    const expectedKinds = {
        text: 'text',
        numberRange: 'numberRange',
        timeRange: 'timeRange',
        dateRange: 'dateRange',
        boolean: 'boolean',
        options: 'options',
        organisationUnit: 'organisationUnit',
        trueOnly: 'trueOnly',
        displayOnly: undefined,
    } satisfies Record<FilterEditorKind, FilterValue['kind'] | undefined>

    const expected = expectedKinds[editor]

    if (!expected || filter.value.kind !== expected) {
        throw new Error(
            `${filter.field.id} requires a ${expected ?? 'supported'} filter value`
        )
    }
}

export const validateAppliedFilter = (
    input: AppliedFilter,
    capabilities: WorkingListCapabilities,
    context?: FilterSerializationContext
): AppliedFilter => {
    const filter = AppliedFilterSchema.parse(input)

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
