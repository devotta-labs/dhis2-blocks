import i18n from '@dhis2/d2-i18n'
import type {
    CellKey,
    CellState,
    GridTable,
    SyncState,
} from '@/components/spreadsheet'
import { fieldIdOfKey, recordIdOf } from '../model/types'
import type { TrackerColumn, TrackerRow } from '../model/types'
import type { EffectsWritten, TrackerEffects, TrackerMessage } from './effects'

export interface SummaryItem {
    /** A cell, or a row for a message without a field. */
    key: string
    kind:
        | 'error'
        | 'warning'
        | 'errorOnComplete'
        | 'warningOnComplete'
        | 'unsent'
        | 'failed'
    text: string
    /** The text names the cell's field ("Age is required"), so the summary names only the row. */
    namesField?: true
}

/** The summary's item kind of a message: its tone, and whether it only holds back completion. */
const kindOf = ({ tone, onComplete }: TrackerMessage): SummaryItem['kind'] => {
    if (!onComplete) {
        return tone
    }
    return tone === 'error' ? 'errorOnComplete' : 'warningOnComplete'
}

const UNSENT = new Set<SyncState>(['queued', 'sending', 'waiting'])
const BLOCKS_COMPLETION = new Set<SummaryItem['kind']>([
    'error',
    'errorOnComplete',
])

// Server reasons and field names are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

/**
 * A cell's field's name: the heading of the column that shows it (a slot's own, where several slots show the field),
 * else the field's name, else its id.
 */
export const fieldNamer = (
    tables: ReadonlyArray<{
        rows: ReadonlyArray<TrackerRow>
        columns: ReadonlyArray<Omit<TrackerColumn, 'field'>>
    }>,
    fieldNames: ReadonlyMap<string, string> = new Map()
) => {
    // By slot and field id; a column with no slot is under the empty slot.
    const headings = new Map<string, string>()
    const slotOf = new Map<string, string>()
    for (const { rows, columns } of tables) {
        for (const { id, fieldId = id, slot = '', label } of columns) {
            headings.set(`${slot}.${fieldId}`, label)
        }
        for (const { slots = {} } of rows) {
            for (const [slot, record] of Object.entries(slots)) {
                slotOf.set(record, slot)
            }
        }
    }
    return (key: string) => {
        const record = recordIdOf(key)
        const field = fieldIdOfKey(key)
        return (
            headings.get(`${slotOf.get(record) ?? ''}.${field}`) ??
            headings.get(`.${field}`) ??
            fieldNames.get(field) ??
            field
        )
    }
}

/** Whether the item stops completion: an error, or an empty required cell. */
export const blocksCompletion = ({ kind }: SummaryItem) =>
    BLOCKS_COMPLETION.has(kind)

type Items = ReadonlyArray<SummaryItem>
const NO_ITEMS: Items = []

/**
 * What a cell says of itself: that it could not be saved, or why it waits, then its own error (a draft its value type
 * refuses) and warning (a stored value the field's checks now reject), both translated when made.
 */
const cellItems = (key: string, cell: CellState): Items => {
    if (
        cell.sync !== 'failed' &&
        cell.reason === undefined &&
        cell.error === undefined &&
        cell.warning === undefined
    ) {
        return NO_ITEMS
    }
    const items: SummaryItem[] = []
    if (cell.sync === 'failed') {
        items.push({
            key,
            kind: 'failed',
            text: i18n.t('Not saved: {{reason}}', {
                nsSeparator: '::',
                reason: cell.reason ?? '',
                interpolation: AS_IS,
            }),
        })
    } else if (UNSENT.has(cell.sync) && cell.reason !== undefined) {
        items.push({ key, kind: 'unsent', text: cell.reason })
    }
    if (cell.error !== undefined) {
        items.push({ key, kind: 'error', text: cell.error })
    }
    if (cell.warning !== undefined) {
        items.push({ key, kind: 'warning', text: cell.warning })
    }
    return items
}

/** That the cell's field, named `field`, is required and empty. */
const requiredItem = (key: string, field: string): SummaryItem => ({
    key,
    kind: 'errorOnComplete',
    text: i18n.t('{{field}} is required', { field, interpolation: AS_IS }),
    namesField: true,
})

const messageItem = (key: string, message: TrackerMessage): SummaryItem => ({
    key,
    kind: kindOf(message),
    text: message.text,
})

/**
 * Every failed cell, every unsent cell with a reason, every cell's own error and warning, every empty required cell
 * and every message, with the unsent and failed counts. Errors and empty required cells stop completion; warnings block nothing.
 */
export const summarise = (
    cells: Partial<Record<CellKey, CellState>>,
    effects: Partial<Record<CellKey, TrackerEffects>>,
    /** Record id → the messages without a field. */
    rowMessages: ReadonlyMap<string, ReadonlyArray<TrackerMessage>>,
    tables: ReadonlyArray<GridTable<TrackerRow, TrackerColumn>>,
    /** Every field's name, for a required field no column shows. */
    fieldNames?: ReadonlyMap<string, string>,
    /** Whether a record is a slot's new event nobody typed in: its required fields are not asked for yet. */
    emptySlot?: (recordId: string) => boolean
) => {
    const items: SummaryItem[] = []
    let unsent = 0
    let failed = 0
    let canComplete = true
    const add = (item: SummaryItem) => {
        items.push(item)
        if (blocksCompletion(item)) {
            canComplete = false
        }
    }

    const values = new Map<string, string | undefined>()
    for (const [key, cell] of Object.entries(cells)) {
        values.set(key, cell?.value)
        if (cell === undefined) {
            continue
        }
        if (cell.sync === 'failed') {
            failed += 1
        } else if (UNSENT.has(cell.sync)) {
            unsent += 1
        }
        cellItems(key, cell).forEach(add)
    }

    // Named only when a required cell is empty: building the names reads every row.
    let nameOf: ReturnType<typeof fieldNamer> | undefined
    for (const [key, cellEffects] of Object.entries(effects)) {
        if (cellEffects === undefined) {
            continue
        }
        const { required, messages } = cellEffects
        if (required && !values.get(key) && !emptySlot?.(recordIdOf(key))) {
            nameOf ??= fieldNamer(tables, fieldNames)
            add(requiredItem(key, nameOf(key)))
        }
        for (const message of messages) {
            add(messageItem(key, message))
        }
    }
    for (const [row, messages] of rowMessages) {
        for (const message of messages) {
            add(messageItem(row, message))
        }
    }
    return { items, unsent, failed, canComplete }
}

const sameItems = (a: Items, b: Items) =>
    a === b ||
    (a.length === b.length &&
        a.every(
            ({ kind, text, namesField }, i) =>
                kind === b[i].kind &&
                text === b[i].text &&
                namesField === b[i].namesField
        ))

const blockersIn = (items: Items) =>
    items.reduce((count, item) => count + (blocksCompletion(item) ? 1 : 0), 0)

/**
 * What each key of an object or a map says, in the order that object or map holds its keys: a key written first comes
 * after the others, one written again keeps its place, and one deleted and written again comes last.
 */
const inKeyOrder = (changed: () => void) => {
    const places = new Map<string, number>()
    let placed = 0
    // Only the keys that say something, and by place in `speaking`.
    const said = new Map<string, Items>()
    const speaking: string[] = []
    let blockers = 0

    /** Where the key is in `speaking`, or where it goes. */
    const indexOf = (key: string) => {
        const place = places.get(key) ?? placed
        let low = 0
        let high = speaking.length
        while (low < high) {
            const middle = Math.floor((low + high) / 2)
            if ((places.get(speaking[middle]) ?? placed) < place) {
                low = middle + 1
            } else {
                high = middle
            }
        }
        return low
    }
    const say = (key: string, items: Items) => {
        const was = said.get(key) ?? NO_ITEMS
        if (sameItems(was, items)) {
            return
        }
        blockers += blockersIn(items) - blockersIn(was)
        changed()
        if (was.length === 0) {
            speaking.splice(indexOf(key), 0, key)
        }
        if (items.length === 0) {
            speaking.splice(indexOf(key), 1)
            said.delete(key)
        } else {
            said.set(key, items)
        }
    }
    return {
        /** The key was written: it takes its place after the others unless it has one. */
        place(key: string) {
            if (!places.has(key)) {
                places.set(key, placed)
                placed += 1
            }
        },
        /** The key was deleted: it says nothing and has no place. */
        remove(key: string) {
            say(key, NO_ITEMS)
            places.delete(key)
        },
        say,
        blockers: () => blockers,
        addTo(items: SummaryItem[]) {
            for (const key of speaking) {
                items.push(...(said.get(key) ?? NO_ITEMS))
            }
        },
    }
}

// SAFETY: an object by cell key has no other keys.
const cellKeysOf = <T>(by: Partial<Record<CellKey, T>>) =>
    Object.keys(by) as CellKey[]

/** Adds the key to the set or takes it out, as `held` says. */
const keep = (keys: Set<string>, key: string, held: boolean) => {
    if (held) {
        keys.add(key)
    } else {
        keys.delete(key)
    }
}

/**
 * `summarise`, kept as the stores change: told which cells a store wrote and what was written to the effects, `read`
 * sums up those cells' records and those rows again, not every cell, and gives the same as `summarise` does. Everything
 * is summed up the first time, after `forget`, and when the tables, the field names or the language are others.
 */
export const runningSummary = () => {
    // Whether an item was added, taken away or changed since the summary last read.
    let changed = false
    const itemsChanged = () => {
        changed = true
    }
    let cellsSay = inKeyOrder(itemsChanged)
    let effectsSay = inKeyOrder(itemsChanged)
    let rowsSay = inKeyOrder(itemsChanged)
    const unsent = new Set<string>()
    const failed = new Set<string>()
    // Record id → its cells with effects: a record's cell is asked for or not by what its other cells hold.
    const effectKeys = new Map<string, Set<CellKey>>()
    const writtenCells = new Set<CellKey>()
    const writtenRecords = new Set<string>()
    const writtenRows = new Set<string>()
    // Nothing is known of what the stores hold.
    let forgotten = true
    let tablesNow: ReadonlyArray<GridTable<TrackerRow, TrackerColumn>> = []
    let fieldNamesNow: ReadonlyMap<string, string> | undefined
    let languageNow: string | undefined
    // Named only when a required cell is empty: building the names reads every row.
    let nameOf: ReturnType<typeof fieldNamer> | undefined
    let summary: ReturnType<typeof summarise> | undefined

    const cellWritten = (key: CellKey) => {
        cellsSay.place(key)
        writtenCells.add(key)
        writtenRecords.add(recordIdOf(key))
    }
    const sumCell = (key: CellKey, cell: CellState | undefined) => {
        keep(failed, key, cell?.sync === 'failed')
        keep(unsent, key, cell !== undefined && UNSENT.has(cell.sync))
        cellsSay.say(key, cell === undefined ? NO_ITEMS : cellItems(key, cell))
    }
    const effectWritten = (key: CellKey, held: boolean) => {
        const record = recordIdOf(key)
        if (held) {
            effectsSay.place(key)
            const keys = effectKeys.get(record) ?? new Set()
            effectKeys.set(record, keys.add(key))
        } else {
            effectsSay.remove(key)
            const keys = effectKeys.get(record)
            if (keys?.delete(key) && keys.size === 0) {
                effectKeys.delete(record)
            }
        }
        writtenRecords.add(record)
    }
    const rowWritten = (row: string, held: boolean) => {
        if (held) {
            rowsSay.place(row)
        } else {
            rowsSay.remove(row)
        }
        writtenRows.add(row)
    }

    return {
        /** The store wrote these cells, in this order. */
        cellsWritten(keys: ReadonlyArray<CellKey>) {
            if (!forgotten) {
                keys.forEach(cellWritten)
            }
        },
        /** An update wrote this to the effects. */
        effectsWritten({ cells, rowMessages }: EffectsWritten) {
            if (forgotten) {
                return
            }
            for (const [key, held] of cells) {
                effectWritten(key, held)
            }
            for (const [row, held] of rowMessages) {
                rowWritten(row, held)
            }
        },
        /** Something changed that was not told: everything is summed up again. */
        forget() {
            forgotten = true
        },
        /** The summary of what the stores hold now: `summarise`'s, the same object while nothing in it changes. */
        read(
            ...[
                cells,
                effects,
                rowMessages,
                tables,
                fieldNames,
                emptySlot,
            ]: Parameters<typeof summarise>
        ) {
            if (
                forgotten ||
                tables !== tablesNow ||
                fieldNames !== fieldNamesNow ||
                i18n.language !== languageNow
            ) {
                forgotten = false
                tablesNow = tables
                fieldNamesNow = fieldNames
                languageNow = i18n.language
                nameOf = undefined
                changed = true
                cellsSay = inKeyOrder(itemsChanged)
                effectsSay = inKeyOrder(itemsChanged)
                rowsSay = inKeyOrder(itemsChanged)
                for (const kept of [
                    unsent,
                    failed,
                    effectKeys,
                    writtenCells,
                    writtenRecords,
                    writtenRows,
                ]) {
                    kept.clear()
                }
                for (const key of cellKeysOf(cells)) {
                    cellsSay.place(key)
                    sumCell(key, cells[key])
                }
                for (const key of cellKeysOf(effects)) {
                    effectWritten(key, true)
                }
                for (const row of rowMessages.keys()) {
                    rowWritten(row, true)
                }
            }

            for (const key of writtenCells) {
                sumCell(key, cells[key])
            }
            for (const record of writtenRecords) {
                let empty: boolean | undefined
                for (const key of effectKeys.get(record) ?? []) {
                    const cellEffects = effects[key]
                    const items: SummaryItem[] = []
                    if (cellEffects?.required && !cells[key]?.value) {
                        empty ??= emptySlot?.(record) ?? false
                        if (!empty) {
                            nameOf ??= fieldNamer(tables, fieldNames)
                            items.push(requiredItem(key, nameOf(key)))
                        }
                    }
                    for (const message of cellEffects?.messages ?? []) {
                        items.push(messageItem(key, message))
                    }
                    effectsSay.say(key, items)
                }
            }
            for (const row of writtenRows) {
                rowsSay.say(
                    row,
                    (rowMessages.get(row) ?? []).map((message) =>
                        messageItem(row, message)
                    )
                )
            }
            writtenCells.clear()
            writtenRecords.clear()
            writtenRows.clear()

            const parts = [cellsSay, effectsSay, rowsSay]
            let items = summary?.items
            if (changed || items === undefined) {
                items = []
                for (const part of parts) {
                    part.addTo(items)
                }
            }
            if (
                items !== summary?.items ||
                unsent.size !== summary.unsent ||
                failed.size !== summary.failed
            ) {
                summary = {
                    items,
                    unsent: unsent.size,
                    failed: failed.size,
                    canComplete: parts.every((part) => part.blockers() === 0),
                }
            }
            changed = false
            return summary
        },
    }
}
