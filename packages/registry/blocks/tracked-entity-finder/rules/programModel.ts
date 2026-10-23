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

/** Whether at least one operator this attribute would send is allowed. */
const canSend = (
    kind: FieldKind,
    unique: boolean,
    blocked: BlockedOperators,
    textOperator: FinderAttribute['textOperator']
): boolean => {
    if (kind === 'unsupported') {
        return false
    }
    if (unique) {
        return !blocked.has('eq')
    }
    switch (kind) {
        case 'text':
            return textOperator !== undefined
        case 'number':
        case 'date':
        case 'dateTime':
            return (
                !blocked.has('eq') || !blocked.has('ge') || !blocked.has('le')
            )
        default:
            return !blocked.has('eq')
    }
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
            canSend(kind, meta.unique, blocked, textOperator),
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
