export type MessageKind =
    | 'error'
    | 'warning'
    | 'errorOnComplete'
    | 'warningOnComplete'

export interface CellMessage {
    kind: MessageKind
    text: string
    source: 'valueType' | 'required' | 'rule' | 'server'
}

/** What logic says about one cell, whatever produced it. */
export interface CellEffects {
    /** Why the cell cannot be edited. */
    readOnly?: string
    /** Why the cell is hidden. */
    hiddenBy?: string
    required: boolean
    messages: CellMessage[]
    /** Option codes the cell does not offer. */
    hiddenOptions?: ReadonlySet<string>
}
