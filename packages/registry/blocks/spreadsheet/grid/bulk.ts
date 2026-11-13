import i18n from '@dhis2/d2-i18n'
import { parseTyped, typedText } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { formatCount } from '@/components/dhis2-value-input'
import type { AnnotationsState } from '../model/annotations'
import type {
    CellKey,
    CellState,
    CommitResult,
    GridColumn,
    GridRow,
    GridTable,
} from '../model/types'
import { addsHiddenOption } from '../store/store'
import type { CellStoreState } from '../store/store'
import { fieldAt } from './navGrid'

/** A cell a bulk action would write, and the text it would commit, as typed. */
export interface BulkCandidate {
    key: CellKey
    text: string
}

type KeyOf = (row: GridRow, column: GridColumn) => CellKey

/** The column action: `text` into every row of the table's column. */
export const columnCandidates = (
    table: GridTable,
    column: GridColumn,
    text: string,
    keyOf: KeyOf
): BulkCandidate[] =>
    table.rows.map((row) => ({ key: keyOf(row, column), text }))

/** The key of the column's first open cell, whose field a column action takes as the column's own. */
export const openKeyOf = (
    table: GridTable,
    column: GridColumn,
    keyOf: KeyOf
): CellKey => {
    const key = table.rows
        .map((row) => keyOf(row, column))
        .find((each) => !table.closed.has(each))
    if (key === undefined) {
        throw new Error(`No open cell in the column ${column.id}`)
    }
    return key
}

/**
 * A row copy: the source row's values, as a Ready cell shows them, onto the target rows' cells of the same columns. A
 * value hidden by a rule is not copied: the person cannot see it.
 */
export const rowCandidates = (
    columns: ReadonlyArray<GridColumn>,
    from: GridRow,
    to: ReadonlyArray<GridRow>,
    keyOf: KeyOf,
    state: CellStoreState,
    annotations: AnnotationsState,
    settings: ValueSettings
): BulkCandidate[] =>
    columns.flatMap((column) => {
        const source = keyOf(from, column)
        const value = state.cells[source]?.value
        if (
            value === undefined ||
            annotations.cells[source]?.hiddenBy !== undefined
        ) {
            return []
        }
        const text = typedText(fieldAt(state, source), value, settings)
        return to.map((row) => ({ key: keyOf(row, column), text }))
    })

/** A clear: no value in each cell. Plan it with overwrite. */
export const clearCandidates = (
    keys: ReadonlyArray<CellKey>
): BulkCandidate[] => keys.map((key) => ({ key, text: '' }))

/** Whether the text adds no option code the cell hides, by the store's own rule. */
const offersAll = (
    state: CellStoreState,
    annotations: AnnotationsState,
    settings: ValueSettings,
    { key, text }: BulkCandidate
) => {
    const hidden = annotations.cells[key]?.hiddenOptions
    if (hidden === undefined) {
        return true
    }
    const field = fieldAt(state, key)
    const parsed = parseTyped(field, text, settings)
    // Text that does not parse is the store's to refuse.
    if (!parsed.ok || parsed.value === undefined) {
        return true
    }
    return !addsHiddenOption(
        field,
        state.cells[key]?.value,
        parsed.value,
        hidden
    )
}

/** Whether the cell holds the text's value already, with no draft to drop and no failed save to send again. */
const holds = (
    state: CellStoreState,
    settings: ValueSettings,
    { key, text }: BulkCandidate
) => {
    const cell = state.cells[key]
    if (cell?.draft !== undefined || cell?.sync === 'failed') {
        return false
    }
    const parsed = parseTyped(fieldAt(state, key), text, settings)
    return parsed.ok && parsed.value === cell?.value
}

/** Whether a commit changed its cell: it queued a value, or dropped the draft over the value the cell holds. */
export const changedBy = (
    result: CommitResult,
    was: CellState | undefined,
    now: CellState | undefined
) =>
    result === 'queued' ||
    (was?.draft !== undefined && now?.draft === undefined)

/** What a bulk action writes and what it leaves alone. */
export interface BulkPlan {
    entries: BulkCandidate[]
    /** Reason → how many cells it skipped. */
    skipped: ReadonlyMap<string, number>
    /** Targets left alone because they hold a value. */
    filled: number
}

/** How many cells were skipped and the most common reason, after a space; empty when none were. */
export const skippedClause = (skipped: ReadonlyMap<string, number>) => {
    const counts = Array.from(skipped)
    if (counts.length === 0) {
        return ''
    }
    const [reason] = counts.reduce((most, each) =>
        each[1] > most[1] ? each : most
    )
    const total = counts.reduce((sum, [, count]) => sum + count, 0)
    return ` ${i18n.t('{{skipped}} skipped: {{reason}}.', {
        nsSeparator: '::',
        interpolation: { escapeValue: false },
        skipped: formatCount(total),
        reason,
    })}`
}

/**
 * What a bulk action writes, for the preview, the confirmation and the write alike. A cell is empty with no value and
 * no draft; one that is not is left alone unless `overwrite`, and one that holds the value already is left out. A cell
 * the person cannot edit, or that does not offer the value's options, is skipped and counted under its reason.
 */
export const planBulk = (
    candidates: ReadonlyArray<BulkCandidate>,
    overwrite: boolean,
    {
        isEditable,
        state,
        annotations,
        settings,
    }: {
        /** Why the cell cannot be edited, or undefined when it can: `reasonOf` for its table. */
        isEditable(key: CellKey): string | undefined
        state: CellStoreState
        annotations: AnnotationsState
        settings: ValueSettings
    }
): BulkPlan => {
    const entries: BulkCandidate[] = []
    const skipped = new Map<string, number>()
    let filled = 0
    for (const candidate of candidates) {
        const cell = state.cells[candidate.key]
        const empty = cell?.value === undefined && cell?.draft === undefined
        if (candidate.text === '' && empty) {
            continue
        }
        const reason = isEditable(candidate.key)
        if (reason === undefined && !overwrite && !empty) {
            filled += 1
            continue
        }
        const skip =
            reason ??
            (offersAll(state, annotations, settings, candidate)
                ? undefined
                : i18n.t('This option is not offered here'))
        if (skip === undefined) {
            if (!holds(state, settings, candidate)) {
                entries.push(candidate)
            }
        } else {
            skipped.set(skip, (skipped.get(skip) ?? 0) + 1)
        }
    }
    return { entries, skipped, filled }
}
