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

/** What a field holds. Dates are ISO `yyyy-mm-dd`; anything else is invalid. */
export type FieldValue =
    | { kind: 'text'; text: string }
    | { kind: 'option'; code?: string }
    | { kind: 'boolean'; value?: 'true' | 'false' }
    | { kind: 'trueOnly'; checked: boolean }
    | { kind: 'number'; value: string }
    | { kind: 'numberRange'; min: string; max: string }
    | { kind: 'date'; date?: string }
    | { kind: 'dateRange'; from?: string; to?: string }

/** A value the user entered that cannot be searched as is. */
export type FieldIssue =
    | 'too-short'
    | 'invalid-number'
    | 'not-integer'
    | 'invalid-date'
    | 'reversed'

/** A field composed into a form. `'range'` comes only from the range part and hook. */
export interface FormField {
    readonly attribute: string
    readonly match: 'exact' | 'range'
}

/** A developer error: the composed form does not fit the program's metadata. */
export type ConfigProblem =
    | {
          readonly kind:
              | 'unknown-attribute'
              | 'not-searchable'
              | 'unsupported-type'
              | 'operators-blocked'
              | 'range-not-supported'
              | 'shape-conflict'
          readonly attribute: string
      }
    | { readonly kind: 'form-cannot-search' }

export interface SearchCondition {
    readonly op: SearchOperator
    readonly value: string
}

export interface SearchFilter {
    readonly attribute: string
    readonly conditions: ReadonlyArray<SearchCondition>
}

declare const validatedSearch: unique symbol

/** A frozen search only `rules/seal` can create; never build one by hand. */
export interface ValidatedSearch {
    readonly [validatedSearch]: true
    readonly filters: ReadonlyArray<SearchFilter>
}

/** Frozen. `search` is present iff `reason === 'ready'`. */
export interface FormVerdict {
    readonly problems: ReadonlyArray<ConfigProblem>
    readonly issues: Readonly<Record<string, FieldIssue>>
    /** Non-unique details still needed to reach the program's minimum. */
    readonly missing: number
    readonly reason:
        | 'empty'
        | 'needs-more'
        | 'two-ids'
        | 'has-issues'
        | 'not-set-up'
        | 'ready'
    /** The unique attribute id when a filled ID searches alone. */
    readonly searchingBy?: string
    /** With `searchingBy`: the other filled details the ID leaves out. */
    readonly dropped?: number
    readonly search?: ValidatedSearch
}
