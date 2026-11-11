import type { AttributeMetadata, ProgramMetadata } from '../api/schemas'
import type {
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

const kindOf = (meta: AttributeMetadata, support: SearchSupport): FieldKind => {
    // Before 2.43 a filter compares the whole stored list, "A,B", so a search
    // for one code would miss everyone who has more than it.
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

const textOperatorOf = (
    meta: AttributeMetadata,
    blocked: ReadonlySet<SearchOperator>
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
    blocked: ReadonlySet<SearchOperator>,
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
    blocked: ReadonlySet<SearchOperator>
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

const toAttribute =
    (support: SearchSupport) =>
    (meta: AttributeMetadata): FinderAttribute => {
        const kind = kindOf(meta, support)
        const blocked = new Set(
            meta.blockedSearchOperators.filter(
                (operator): operator is SearchOperator =>
                    SEARCH_OPERATORS.includes(operator)
            )
        )
        const textOperator =
            kind === 'text' ? textOperatorOf(meta, blocked) : undefined
        return {
            id: meta.id,
            label: meta.label,
            valueType: meta.valueType,
            kind,
            unique: meta.unique,
            searchable: meta.searchable,
            displayInList: meta.displayInList,
            options: meta.options,
            textOperator,
            blocked,
            minCharacters: meta.minCharactersToSearch,
            usable:
                meta.searchable &&
                canSend({ kind, unique: meta.unique, textOperator }, blocked),
        }
    }

/** Without `support`, MULTI_TEXT attributes cannot be searched. */
export const buildProgramModel = (
    meta: ProgramMetadata,
    support: SearchSupport = { multiTextSearch: false }
): ProgramModel => ({
    program: meta.program,
    name: meta.name,
    trackedEntityType: meta.trackedEntityType,
    attributes: meta.attributes.map(toAttribute(support)),
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
