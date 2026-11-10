import i18n from '@dhis2/d2-i18n'
import type {
    CellKey,
    CellState,
    GridTable,
    SyncState,
} from '@/components/spreadsheet'
import { fieldIdOfKey, recordIdOf } from '../model/types'
import type { TrackerColumn, TrackerRow } from '../model/types'
import type { TrackerEffects, TrackerMessage } from './effects'

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

type Summary = {
    items: SummaryItem[]
    unsent: number
    failed: number
    canComplete: boolean
}

type Summarise = (
    cells: Partial<Record<CellKey, CellState>>,
    effects: Partial<Record<CellKey, TrackerEffects>>,
    rowMessages: ReadonlyMap<string, ReadonlyArray<TrackerMessage>>,
    tables: ReadonlyArray<GridTable<TrackerRow, TrackerColumn>>,
    fieldNames?: ReadonlyMap<string, string>,
    emptySlot?: (recordId: string) => boolean
) => Summary

type CellSummary = {
    items: SummaryItem[]
    unsent: number
    failed: number
}

type RowSummary = {
    cells: Map<CellKey, CellSummary>
    effects: Map<CellKey, SummaryItem[]>
    messages: SummaryItem[]
    unsent: number
    failed: number
    canComplete: boolean
}

const hasOwn = <Value>(value: Partial<Record<CellKey, Value>>, key: CellKey) =>
    Object.hasOwn(value, key)

const keysOf = <Value>(value: Partial<Record<CellKey, Value>>): CellKey[] => {
    // SAFETY: Every enumerable key belongs to the `CellKey`-indexed record.
    return Object.keys(value) as CellKey[]
}

const addKey = (keysByRecord: Map<string, Set<CellKey>>, key: CellKey) => {
    const record = recordIdOf(key)
    let keys = keysByRecord.get(record)
    if (keys === undefined) {
        keys = new Set()
        keysByRecord.set(record, keys)
    }
    keys.add(key)
}

const removeKey = (keysByRecord: Map<string, Set<CellKey>>, key: CellKey) => {
    const record = recordIdOf(key)
    const keys = keysByRecord.get(record)
    keys?.delete(key)
    if (keys?.size === 0) {
        keysByRecord.delete(record)
    }
}

const changedRecords = <Value>(
    previous: Partial<Record<CellKey, Value>> | undefined,
    next: Partial<Record<CellKey, Value>>,
    keysByRecord: Map<string, Set<CellKey>>,
    dirty: Set<string>
) => {
    for (const key of keysOf(next)) {
        const value = next[key]
        if (
            previous === undefined ||
            !hasOwn(previous, key) ||
            previous[key] !== value
        ) {
            dirty.add(recordIdOf(key))
        }
        if (previous === undefined || !hasOwn(previous, key)) {
            addKey(keysByRecord, key)
        }
    }
    if (previous !== undefined) {
        for (const key of keysOf(previous)) {
            if (!hasOwn(next, key)) {
                dirty.add(recordIdOf(key))
                removeKey(keysByRecord, key)
            }
        }
    }
}

const cellSummary = (
    key: CellKey,
    cell: CellState | undefined
): CellSummary => {
    const items: SummaryItem[] = []
    let unsent = 0
    let failed = 0
    if (cell?.sync === 'failed') {
        failed += 1
        items.push({
            key,
            kind: 'failed',
            text: i18n.t('Not saved: {{reason}}', {
                nsSeparator: '::',
                reason: cell.reason ?? '',
                interpolation: AS_IS,
            }),
        })
    } else if (cell !== undefined && UNSENT.has(cell.sync)) {
        unsent += 1
        if (cell.reason !== undefined) {
            items.push({ key, kind: 'unsent', text: cell.reason })
        }
    }
    if (cell?.error !== undefined) {
        items.push({ key, kind: 'error', text: cell.error })
    }
    if (cell?.warning !== undefined) {
        items.push({ key, kind: 'warning', text: cell.warning })
    }
    return { items, unsent, failed }
}

/** Keep one summary per record, replacing only records whose source references changed. */
export const createSummariser = (): Summarise => {
    let previousCells: Partial<Record<CellKey, CellState>> | undefined
    let previousEffects: Partial<Record<CellKey, TrackerEffects>> | undefined
    let previousMessages:
        | ReadonlyMap<string, ReadonlyArray<TrackerMessage>>
        | undefined
    let previousTables:
        | ReadonlyArray<GridTable<TrackerRow, TrackerColumn>>
        | undefined
    let previousFieldNames: ReadonlyMap<string, string> | undefined
    let previousLanguage: string | undefined
    let previousEmptySlots = new Map<string, boolean | undefined>()
    let nameOf: ReturnType<typeof fieldNamer> | undefined
    let initialized = false

    const cellKeysByRecord = new Map<string, Set<CellKey>>()
    const effectKeysByRecord = new Map<string, Set<CellKey>>()
    const rows = new Map<string, RowSummary>()

    return (cells, effects, rowMessages, tables, fieldNames, emptySlot) => {
        const dirty = new Set<string>()
        changedRecords(previousCells, cells, cellKeysByRecord, dirty)
        changedRecords(previousEffects, effects, effectKeysByRecord, dirty)

        for (const [record, messages] of rowMessages) {
            if (
                previousMessages === undefined ||
                !previousMessages.has(record) ||
                previousMessages.get(record) !== messages
            ) {
                dirty.add(record)
            }
        }
        if (previousMessages !== undefined) {
            for (const record of previousMessages.keys()) {
                if (!rowMessages.has(record)) {
                    dirty.add(record)
                }
            }
        }

        const emptySlots = new Map<string, boolean | undefined>()
        for (const key of keysOf(effects)) {
            const cellEffects = effects[key]
            if (cellEffects?.required) {
                const record = recordIdOf(key)
                const empty = emptySlot?.(record)
                emptySlots.set(record, empty)
                if (
                    previousEmptySlots.has(record) &&
                    previousEmptySlots.get(record) !== empty
                ) {
                    dirty.add(record)
                }
            }
        }
        for (const record of previousEmptySlots.keys()) {
            if (!emptySlots.has(record)) {
                dirty.add(record)
            }
        }

        const languageChanged = previousLanguage !== i18n.language
        const contextChanged =
            !initialized ||
            previousTables !== tables ||
            previousFieldNames !== fieldNames ||
            languageChanged
        if (contextChanged) {
            for (const record of rows.keys()) {
                dirty.add(record)
            }
            for (const record of cellKeysByRecord.keys()) {
                dirty.add(record)
            }
            for (const record of effectKeysByRecord.keys()) {
                dirty.add(record)
            }
            for (const record of rowMessages.keys()) {
                dirty.add(record)
            }
            nameOf = undefined
        }

        for (const record of dirty) {
            const row: RowSummary = {
                cells: new Map(),
                effects: new Map(),
                messages: [],
                unsent: 0,
                failed: 0,
                canComplete: true,
            }
            const trackCompletion = (items: ReadonlyArray<SummaryItem>) => {
                if (items.some(blocksCompletion)) {
                    row.canComplete = false
                }
            }
            for (const key of cellKeysByRecord.get(record) ?? []) {
                const summary = cellSummary(key, cells[key])
                row.cells.set(key, summary)
                row.unsent += summary.unsent
                row.failed += summary.failed
                trackCompletion(summary.items)
            }
            for (const key of effectKeysByRecord.get(record) ?? []) {
                const cellEffects = effects[key]
                if (cellEffects === undefined) {
                    continue
                }
                const items: SummaryItem[] = []
                if (
                    cellEffects.required &&
                    !cells[key]?.value &&
                    !emptySlots.get(record)
                ) {
                    nameOf ??= fieldNamer(tables, fieldNames)
                    items.push({
                        key,
                        kind: 'errorOnComplete',
                        text: i18n.t('{{field}} is required', {
                            field: nameOf(key),
                            interpolation: AS_IS,
                        }),
                        namesField: true,
                    })
                }
                for (const message of cellEffects.messages) {
                    items.push({
                        key,
                        kind: kindOf(message),
                        text: message.text,
                    })
                }
                row.effects.set(key, items)
                trackCompletion(items)
            }
            for (const message of rowMessages.get(record) ?? []) {
                row.messages.push({
                    key: record,
                    kind: kindOf(message),
                    text: message.text,
                })
            }
            trackCompletion(row.messages)
            if (
                row.cells.size === 0 &&
                row.effects.size === 0 &&
                row.messages.length === 0
            ) {
                rows.delete(record)
            } else {
                rows.set(record, row)
            }
        }

        const items: SummaryItem[] = []
        let unsent = 0
        let failed = 0
        let canComplete = true
        const add = (newItems: ReadonlyArray<SummaryItem> | undefined) => {
            if (newItems === undefined) {
                return
            }
            items.push(...newItems)
        }
        for (const key of keysOf(cells)) {
            add(rows.get(recordIdOf(key))?.cells.get(key)?.items)
        }
        for (const key of keysOf(effects)) {
            add(rows.get(recordIdOf(key))?.effects.get(key))
        }
        for (const [record] of rowMessages) {
            add(rows.get(record)?.messages)
        }
        for (const row of rows.values()) {
            unsent += row.unsent
            failed += row.failed
            if (!row.canComplete) {
                canComplete = false
            }
        }

        previousCells = cells
        previousEffects = effects
        previousMessages = rowMessages
        previousTables = tables
        previousFieldNames = fieldNames
        previousLanguage = i18n.language
        previousEmptySlots = emptySlots
        initialized = true

        return { items, unsent, failed, canComplete }
    }
}

/**
 * Every failed cell, every unsent cell with a reason, every cell's own error and warning, every empty required cell
 * and every message, with the unsent and failed counts. Errors and empty required cells stop completion; warnings block nothing.
 */
export const summarise: Summarise = (
    cells: Partial<Record<CellKey, CellState>>,
    effects: Partial<Record<CellKey, TrackerEffects>>,
    /** Record id → the messages without a field. */
    rowMessages: ReadonlyMap<string, ReadonlyArray<TrackerMessage>>,
    tables: ReadonlyArray<GridTable<TrackerRow, TrackerColumn>>,
    /** Every field's name, for a required field no column shows. */
    fieldNames?: ReadonlyMap<string, string>,
    /** Whether a record is a slot's new event nobody typed in: its required fields are not asked for yet. */
    emptySlot?: (recordId: string) => boolean
) =>
    createSummariser()(
        cells,
        effects,
        rowMessages,
        tables,
        fieldNames,
        emptySlot
    )
