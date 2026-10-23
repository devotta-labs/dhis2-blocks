import type { AttributeMetadata, ProgramMetadata } from '../api/schemas'
import type {
    BlockedOperators,
    FieldKind,
    FinderAttribute,
    ProgramModel,
    SearchOperator,
} from './types'

const SEARCH_OPERATORS: readonly string[] = [
    'eq',
    'like',
    'sw',
    'gt',
    'ge',
    'lt',
    'le',
]
const TEXT_OPERATORS = ['like', 'sw', 'eq'] as const

const TEXT_TYPES = new Set([
    'TEXT',
    'LONG_TEXT',
    'LETTER',
    'PHONE_NUMBER',
    'EMAIL',
    'URL',
    'USERNAME',
])
const NUMBER_TYPES = new Set([
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
])

const kindOf = (meta: AttributeMetadata): FieldKind => {
    if (meta.options) {
        return 'option'
    }
    if (TEXT_TYPES.has(meta.valueType)) {
        return 'text'
    }
    if (NUMBER_TYPES.has(meta.valueType)) {
        return 'number'
    }
    switch (meta.valueType) {
        case 'BOOLEAN':
            return 'boolean'
        case 'TRUE_ONLY':
            return 'trueOnly'
        case 'DATE':
        case 'AGE':
            return 'date'
        case 'DATETIME':
            return 'dateTime'
        default:
            return 'unsupported'
    }
}

/**
 * Operators that can be read but not changed: unlike a frozen Set, this has
 * no add/delete/clear, and Set methods called on it throw.
 */
const blockedOperators = (
    operators: Iterable<SearchOperator>
): BlockedOperators => {
    const set = new Set(operators)
    return Object.freeze({
        get size() {
            return set.size
        },
        has: (operator: SearchOperator) => set.has(operator),
        [Symbol.iterator]: () => set.values(),
    })
}

const textOperatorOf = (
    meta: AttributeMetadata,
    blocked: BlockedOperators
): FinderAttribute['textOperator'] => {
    const preferred = TEXT_OPERATORS.find(
        (operator) => operator === meta.preferredSearchOperator
    )
    if (preferred && !blocked.has(preferred)) {
        return preferred
    }
    return TEXT_OPERATORS.find((operator) => !blocked.has(operator))
}

/** The kinds a `FinderRangeField` can search, when not unique. */
export const RANGE_KINDS: ReadonlySet<FieldKind> = new Set([
    'number',
    'date',
    'dateTime',
])

type OperatorSource = Pick<FinderAttribute, 'kind' | 'unique' | 'textOperator'>

/** The operators a field of this kind and match sends; all must be allowed. */
const operatorsFor = (
    attribute: OperatorSource,
    match: 'exact' | 'range'
): readonly (SearchOperator | undefined)[] => {
    if (match === 'range' || attribute.kind === 'dateTime') {
        return attribute.unique ? ['eq'] : ['ge', 'le']
    }
    if (attribute.kind === 'text' && !attribute.unique) {
        return [attribute.textOperator]
    }
    return ['eq']
}

/** Whether a match sends only operators that are allowed. */
export const canSendMatch = (
    attribute: OperatorSource,
    blocked: BlockedOperators,
    match: 'exact' | 'range'
): boolean =>
    operatorsFor(attribute, match).every(
        (operator) => operator !== undefined && !blocked.has(operator)
    )

/**
 * Whether some field can search this attribute: the exact match, or the range
 * match where the kind allows one. The same check judges composed fields.
 */
const canSend = (
    attribute: OperatorSource,
    blocked: BlockedOperators
): boolean => {
    if (attribute.kind === 'unsupported') {
        return false
    }
    const rangeable = !attribute.unique && RANGE_KINDS.has(attribute.kind)
    return (
        canSendMatch(attribute, blocked, 'exact') ||
        (rangeable && canSendMatch(attribute, blocked, 'range'))
    )
}

const toAttribute = (meta: AttributeMetadata): FinderAttribute => {
    const kind = kindOf(meta)
    const blocked = blockedOperators(
        meta.blockedSearchOperators.filter(
            (operator): operator is SearchOperator =>
                SEARCH_OPERATORS.includes(operator)
        )
    )
    const textOperator =
        kind === 'text' ? textOperatorOf(meta, blocked) : undefined
    return Object.freeze({
        id: meta.id,
        label: meta.label,
        valueType: meta.valueType,
        kind,
        unique: meta.unique,
        searchable: meta.searchable,
        displayInList: meta.displayInList,
        blocked,
        minCharacters: meta.minCharactersToSearch,
        usable:
            meta.searchable &&
            canSend({ kind, unique: meta.unique, textOperator }, blocked),
        ...(meta.options && {
            options: Object.freeze(
                meta.options.map(({ code, name }) =>
                    Object.freeze({ code, name })
                )
            ),
        }),
        ...(textOperator && { textOperator }),
    })
}

export const buildProgramModel = (meta: ProgramMetadata): ProgramModel =>
    Object.freeze({
        program: meta.program,
        name: meta.name,
        trackedEntityType: meta.trackedEntityType,
        attributes: Object.freeze(meta.attributes.map(toAttribute)),
        minAttributes: meta.minAttributesRequiredToSearch,
        maxResults: meta.maxTeiCountToReturn,
    })

export const attributeOf = (
    model: ProgramModel,
    id: string
): FinderAttribute | undefined =>
    model.attributes.find((attribute) => attribute.id === id)

/** Usable attributes, in metadata order. */
export const searchableAttributes = (
    model: ProgramModel
): readonly FinderAttribute[] =>
    model.attributes.filter((attribute) => attribute.usable)
