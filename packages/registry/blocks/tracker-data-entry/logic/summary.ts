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
const notSavedText = (reason: string): string =>
    i18n.t('Not saved: {{reason}}', {
        nsSeparator: '::',
        reason,
        interpolation: AS_IS,
    })
const requiredText = (field: string): string =>
    i18n.t('{{field}} is required', {
        field,
        interpolation: AS_IS,
    })

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
    const notSaved = new Map<string, string>()
    for (const [key, cell] of Object.entries(cells)) {
        values.set(key, cell?.value)
        if (cell?.sync === 'failed') {
            failed += 1
            const reason = cell.reason ?? ''
            let text = notSaved.get(reason)
            if (text === undefined) {
                text = notSavedText(reason)
                notSaved.set(reason, text)
            }
            add({
                key,
                kind: 'failed',
                text,
            })
        } else if (cell !== undefined && UNSENT.has(cell.sync)) {
            unsent += 1
            if (cell.reason !== undefined) {
                add({ key, kind: 'unsent', text: cell.reason })
            }
        }
        // A draft its value type refuses, and a stored value the field's checks now reject; translated when made.
        if (cell?.error !== undefined) {
            add({ key, kind: 'error', text: cell.error })
        }
        if (cell?.warning !== undefined) {
            add({ key, kind: 'warning', text: cell.warning })
        }
    }

    // Named only when a required cell is empty: building the names reads every row.
    let nameOf: ReturnType<typeof fieldNamer> | undefined
    const requiredMessages = new Map<string, string>()
    for (const [key, cellEffects] of Object.entries(effects)) {
        if (cellEffects === undefined) {
            continue
        }
        const { required, messages } = cellEffects
        if (required && !values.get(key) && !emptySlot?.(recordIdOf(key))) {
            nameOf ??= fieldNamer(tables, fieldNames)
            const field = nameOf(key)
            let text = requiredMessages.get(field)
            if (text === undefined) {
                text = requiredText(field)
                requiredMessages.set(field, text)
            }
            add({
                key,
                kind: 'errorOnComplete',
                text,
                namesField: true,
            })
        }
        for (const message of messages) {
            add({ key, kind: kindOf(message), text: message.text })
        }
    }
    for (const [row, messages] of rowMessages) {
        for (const message of messages) {
            add({ key: row, kind: kindOf(message), text: message.text })
        }
    }
    return { items, unsent, failed, canComplete }
}
