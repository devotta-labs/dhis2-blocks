import i18n from '@dhis2/d2-i18n'
import type { CellKey, CellState, GridTable, SyncState } from '../model/types'
import type { CellEffects, CellMessage, MessageKind } from './effects'

export interface SummaryItem {
    /** A cell, or a row for a message without a field. */
    key: CellKey | string
    kind: MessageKind | 'unsent' | 'failed'
    text: string
    /** The text names the cell's field ("Age is required"), so the summary names only the row. */
    namesField?: true
}

const UNSENT = new Set<SyncState>(['queued', 'sending', 'waiting'])
const BLOCKS_COMPLETION = new Set<SummaryItem['kind']>([
    'error',
    'errorOnComplete',
])

// Server reasons and field names are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

/** Whether the item stops completion: an error, or an empty required cell. */
export const blocksCompletion = ({ kind }: SummaryItem) =>
    BLOCKS_COMPLETION.has(kind)

/**
 * Every failed cell, every unsent cell with a reason, every cell's own error and warning, every empty required cell
 * and every message, with the unsent and failed counts. Errors and empty required cells stop completion; warnings block nothing.
 */
export const summarise = (
    cells: Partial<Record<CellKey, CellState>>,
    effects: Partial<Record<CellKey, CellEffects>>,
    /** Row id → the messages without a field. */
    rowMessages: ReadonlyMap<string, ReadonlyArray<CellMessage>>,
    tables: ReadonlyArray<GridTable>
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
        if (cell?.sync === 'failed') {
            failed += 1
            add({
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

    const labels = new Map(
        tables.flatMap(({ columns }) =>
            columns.map(({ id, label }) => [id, label])
        )
    )
    for (const [key, cellEffects] of Object.entries(effects)) {
        if (cellEffects === undefined) {
            continue
        }
        const { required, messages } = cellEffects
        if (required && !values.get(key)) {
            const column = key.slice(key.indexOf('.') + 1)
            add({
                key,
                kind: 'errorOnComplete',
                text: i18n.t('{{field}} is required', {
                    field: labels.get(column) ?? column,
                    interpolation: AS_IS,
                }),
                namesField: true,
            })
        }
        for (const { kind, text } of messages) {
            add({ key, kind, text })
        }
    }
    for (const [row, messages] of rowMessages) {
        for (const { kind, text } of messages) {
            add({ key: row, kind, text })
        }
    }
    return { items, unsent, failed, canComplete }
}
