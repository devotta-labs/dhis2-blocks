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

/** What the server lets the finder search. */
export interface SearchSupport {
    /** Whether each code of a MULTI_TEXT value is matched (DHIS2 2.43+). */
    readonly multiTextSearch: boolean
}

const kindOf = (meta: AttributeMetadata, support: SearchSupport) => {
    if (meta.valueType === 'MULTI_TEXT') {
        return meta.options && support.multiTextSearch
            ? 'multiText'
            : 'unsupported'
    }
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

const blockedOperators = (operators: Iterable<SearchOperator>) => {
    const set = new Set(operators)
    return Object.freeze({
        get size() {
            return set.size
        },
        has: (operator: SearchOperator) => set.has(operator),
        [Symbol.iterator]: () => set.values(),
    })
}

const textOperatorOf = (meta: AttributeMetadata, blocked: BlockedOperators) => {
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

const operatorsFor: (
    attribute: OperatorSource,
    match: 'exact' | 'range'
) => readonly (SearchOperator | undefined)[] = (attribute, match) => {
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
) =>
    operatorsFor(attribute, match).every(
        (operator) => operator !== undefined && !blocked.has(operator)
    )

const canSend = (attribute: OperatorSource, blocked: BlockedOperators) => {
    if (attribute.kind === 'unsupported') {
        return false
    }
    const rangeable = !attribute.unique && RANGE_KINDS.has(attribute.kind)
    return (
        canSendMatch(attribute, blocked, 'exact') ||
        (rangeable && canSendMatch(attribute, blocked, 'range'))
    )
}

const toAttribute = (support: SearchSupport) => (meta: AttributeMetadata) => {
    const kind = kindOf(meta, support)
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

/** Without `support`, MULTI_TEXT attributes cannot be searched. */
export const buildProgramModel: (
    meta: ProgramMetadata,
    support?: SearchSupport
) => ProgramModel = (meta, support = { multiTextSearch: false }) =>
    Object.freeze({
        program: meta.program,
        name: meta.name,
        trackedEntityType: meta.trackedEntityType,
        attributes: Object.freeze(meta.attributes.map(toAttribute(support))),
        minAttributes: meta.minAttributesRequiredToSearch,
        maxResults: meta.maxTeiCountToReturn,
    })

export const attributeOf = (model: ProgramModel, id: string) =>
    model.attributes.find((attribute) => attribute.id === id)

/** Usable attributes, in metadata order. */
export const searchableAttributes: (
    model: ProgramModel
) => readonly FinderAttribute[] = (model) =>
    model.attributes.filter((attribute) => attribute.usable)
