import type {
    AnnotationsState,
    CellAnnotations,
    CellKey,
    CellMessage,
} from '@/components/spreadsheet'

/** The `rowMessages` key of messages about the whole form; no row has an empty id. */
export const FORM_MESSAGES = ''

/** A message with who wrote it, so a producer replaces only its own, and whether it holds back completion only. */
export interface TrackerMessage extends CellMessage {
    source: 'valueType' | 'required' | 'rule' | 'server'
    onComplete?: true
}

export interface TrackerEffects extends CellAnnotations {
    messages: ReadonlyArray<TrackerMessage>
}

export interface TrackerEffectsState extends AnnotationsState {
    cells: Partial<Record<CellKey, TrackerEffects>>
    rowMessages: ReadonlyMap<string, ReadonlyArray<TrackerMessage>>
}

export const sameMessages = (
    a: ReadonlyArray<TrackerMessage>,
    b: ReadonlyArray<TrackerMessage>
) =>
    a.length === b.length &&
    a.every(
        ({ tone, text, source, onComplete }, i) =>
            tone === b[i].tone &&
            text === b[i].text &&
            source === b[i].source &&
            onComplete === b[i].onComplete
    )

const sameCodes = (a?: ReadonlySet<string>, b?: ReadonlySet<string>) =>
    a === b ||
    (a !== undefined &&
        b !== undefined &&
        a.size === b.size &&
        [...a].every((code) => b.has(code)))

/** Whether two cells' effects say the same; `undefined` says nothing. */
export const sameEffects = (a?: TrackerEffects, b?: TrackerEffects) =>
    a === b ||
    (a !== undefined &&
        b !== undefined &&
        a.readOnly === b.readOnly &&
        a.hiddenBy === b.hiddenBy &&
        a.required === b.required &&
        sameMessages(a.messages, b.messages) &&
        sameCodes(a.hiddenOptions, b.hiddenOptions))

/** Whether the effects say nothing a cell with none would not. */
export const saysNothing = (effects: TrackerEffects) =>
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
