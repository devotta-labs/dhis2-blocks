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

export const sameMessages = (
    a: ReadonlyArray<CellMessage>,
    b: ReadonlyArray<CellMessage>
) =>
    a.length === b.length &&
    a.every(
        ({ kind, text, source }, i) =>
            kind === b[i].kind && text === b[i].text && source === b[i].source
    )

const sameCodes = (a?: ReadonlySet<string>, b?: ReadonlySet<string>) =>
    a === b ||
    (a !== undefined &&
        b !== undefined &&
        a.size === b.size &&
        [...a].every((code) => b.has(code)))

/** Whether two cells' effects say the same; `undefined` says nothing. */
export const sameEffects = (a?: CellEffects, b?: CellEffects) =>
    a === b ||
    (a !== undefined &&
        b !== undefined &&
        a.readOnly === b.readOnly &&
        a.hiddenBy === b.hiddenBy &&
        a.required === b.required &&
        sameMessages(a.messages, b.messages) &&
        sameCodes(a.hiddenOptions, b.hiddenOptions))

/** Whether the effects say nothing a cell with none would not. */
export const saysNothing = (effects: CellEffects) =>
    !effects.required &&
    effects.messages.length === 0 &&
    effects.readOnly === undefined &&
    effects.hiddenBy === undefined &&
    effects.hiddenOptions === undefined

export const sameNotes = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
    a.length === b.length && a.every((note, i) => note === b[i])

/** The map with the row's list, or the same map when the list is the same; an empty list leaves the row out. */
export const withRow = <T>(
    map: ReadonlyMap<string, ReadonlyArray<T>>,
    rowId: string,
    list: ReadonlyArray<T>,
    same: (a: ReadonlyArray<T>, b: ReadonlyArray<T>) => boolean
) => {
    if (same(list, map.get(rowId) ?? [])) {
        return map
    }
    const copy = new Map(map)
    if (list.length === 0) {
        copy.delete(rowId)
    } else {
        copy.set(rowId, list)
    }
    return copy
}
