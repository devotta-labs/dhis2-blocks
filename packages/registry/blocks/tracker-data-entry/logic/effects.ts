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

/**
 * Every write of one update to the effects' `cells` and `rowMessages`, in the order it made them: the cell or the row,
 * and whether it holds something after the write (set) or nothing (deleted). `before` is what the update wrote over.
 */
export interface EffectsWritten {
    before: Pick<TrackerEffectsState, 'cells' | 'rowMessages'>
    cells: ReadonlyArray<readonly [key: CellKey, held: boolean]>
    rowMessages: ReadonlyArray<readonly [rowId: string, held: boolean]>
}

export interface TrackerEffectsState extends AnnotationsState {
    cells: Partial<Record<CellKey, TrackerEffects>>
    rowMessages: ReadonlyMap<string, ReadonlyArray<TrackerMessage>>
    /**
     * What the update that put `cells` and `rowMessages` here wrote, set with them by an update that keeps track
     * (`effectsWriter`), so the summary sums up only those cells and rows again. An update that sets none leaves the
     * last one's here: it is this update's only when it is not the state before's and what it wrote over is.
     */
    written?: EffectsWritten
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

/**
 * Writes to the effects' cells and row messages, copied once something is written and kept in the order they were
 * made: `state` is what to set on the effects' store, the same `cells` and `rowMessages` when nothing was written.
 */
export const effectsWriter = (
    state: Pick<TrackerEffectsState, 'cells' | 'rowMessages'>
) => {
    let { cells, rowMessages } = state
    const written = {
        // Not the state itself, which holds the account of the update before it, and so every one since the first.
        before: { cells, rowMessages },
        cells: new Array<[CellKey, boolean]>(),
        rowMessages: new Array<[string, boolean]>(),
    }
    return {
        /** Sets what is said of the cell, or deletes it when it says nothing; no write when it says the same. */
        setCell(key: CellKey, effects: TrackerEffects) {
            const kept = saysNothing(effects) ? undefined : effects
            if (sameEffects(kept, cells[key])) {
                return
            }
            cells = cells === written.before.cells ? { ...cells } : cells
            if (kept === undefined) {
                delete cells[key]
            } else {
                cells[key] = kept
            }
            written.cells.push([key, kept !== undefined])
        },
        /** Sets the row's messages, or deletes them when there are none; no write when they are the same. */
        setRowMessages(rowId: string, messages: ReadonlyArray<TrackerMessage>) {
            const next = withRow(rowMessages, rowId, messages, sameMessages)
            if (next !== rowMessages) {
                rowMessages = next
                written.rowMessages.push([rowId, next.has(rowId)])
            }
        },
        state: () => ({ cells, rowMessages, written }),
    }
}
