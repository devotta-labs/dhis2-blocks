export type FieldKind =
    | 'text'
    | 'option'
    | 'boolean'
    | 'trueOnly'
    | 'number'
    | 'date'
    | 'dateTime'
    /** Display-only: a value type that cannot be searched. */
    | 'unsupported'

export type SearchOperator = 'eq' | 'like' | 'sw' | 'gt' | 'ge' | 'lt' | 'le'

/** Operators an attribute blocks; it can be read but not changed. */
export type BlockedOperators = Pick<
    ReadonlySet<SearchOperator>,
    'has' | 'size' | typeof Symbol.iterator
>

/** Read-only all the way down; the built model is frozen too. */
export interface FinderAttribute {
    readonly id: string
    readonly label: string
    readonly valueType: string
    readonly kind: FieldKind
    readonly unique: boolean
    readonly searchable: boolean
    readonly displayInList: boolean
    readonly options?: ReadonlyArray<{
        readonly code: string
        readonly name: string
    }>
    /** Text kind only. */
    readonly textOperator?: 'like' | 'sw' | 'eq'
    readonly blocked: BlockedOperators
    readonly minCharacters: number
    /** Searchable, a supported kind, and an operator it would send is allowed. */
    readonly usable: boolean
}

/** Read-only all the way down; the built model is frozen too. */
export interface ProgramModel {
    readonly program: string
    readonly name: string
    readonly trackedEntityType: string
    /** In metadata order. */
    readonly attributes: ReadonlyArray<FinderAttribute>
    readonly minAttributes: number
    /** 0 = no cap. */
    readonly maxResults: number
}
