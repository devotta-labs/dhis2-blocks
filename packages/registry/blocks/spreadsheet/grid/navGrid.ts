import i18n from '@dhis2/d2-i18n'
import type { StoreApi } from 'zustand/vanilla'
import type { Field } from '@/components/dhis2-value-types'
import { replacementFor } from '../cells/Cell'
import { cellDomId } from '../cells/cellProps'
import type { CellOverrides } from '../cells/cellProps'
import { takesPastedText } from '../cells/popupEditors'
import type { AnnotationsState } from '../model/annotations'
import { indexCells } from '../model/types'
import type { CellKey, CellPlace, GridTable } from '../model/types'
import type { ReadonlyStore, SpreadsheetContext } from '../provider/context'
import type { CellStoreState } from '../store/store'
import type { NavGrid } from './navigation'

/** The cell's field; a cell the form holds no field for is the source's error, as a commit to it is. */
export const fieldAt = (state: CellStoreState, key: CellKey): Field => {
    const field = state.fieldOf(key)
    if (field === undefined) {
        throw new Error(`No field for the cell ${key}`)
    }
    return field
}

/**
 * Whether typed or pasted text can go into the cell's field. Read-only kinds, pop-up kinds without an editor, pop-up
 * kinds whose text does not parse (files) and usernames cannot, unless a replacement edits them.
 */
export const typedHere = (
    state: CellStoreState,
    key: CellKey,
    overrides: CellOverrides | undefined
) => {
    const field = fieldAt(state, key)
    return (
        takesPastedText(field) ||
        replacementFor(overrides, state.fieldIdOf(key), field) !== undefined
    )
}

/**
 * Why a typed or pasted value cannot go into a table's cell, named as the cell names it, or undefined when it can:
 * closed, hidden by a rule, read-only, or a kind paste cannot fill.
 */
export const reasonOf =
    (
        closed: GridTable['closed'],
        store: StoreApi<CellStoreState>,
        effects: ReadonlyStore<AnnotationsState>,
        overrides: CellOverrides | undefined
    ) =>
    (key: CellKey): string | undefined => {
        const closedReason = closed.get(key)
        if (closedReason !== undefined) {
            return closedReason
        }
        const cell = effects.getState().cells[key]
        if (cell?.hiddenBy !== undefined || cell?.readOnly !== undefined) {
            return cell.hiddenBy ?? cell.readOnly
        }
        return typedHere(store.getState(), key, overrides)
            ? undefined
            : i18n.t('Edit this field in its own form')
    }

/** What `nextCell` and `pasteTargets` walk; each lookup is a map read, as they ask once per cell stepped over. */
export const navGrid = (
    tables: ReadonlyArray<GridTable>,
    store: StoreApi<CellStoreState>,
    effects: ReadonlyStore<AnnotationsState>,
    overrides: CellOverrides | undefined,
    keyOf: SpreadsheetContext['keyOf']
): NavGrid => ({
    tables: tables.map(({ rows, columns, closed }) => {
        const keyAt = (row: number, column: number) =>
            keyOf(rows[row], columns[column])
        const reason = reasonOf(closed, store, effects, overrides)
        return {
            rows: rows.length,
            columns: columns.length,
            isOpen: (row, column) => !closed.has(keyAt(row, column)),
            isEditable: (row, column) =>
                reason(keyAt(row, column)) === undefined,
        }
    }),
})

/** Where each cell control is, by its DOM id; closed cells have no control. */
export const positionsOf = (
    idScope: string,
    tables: ReadonlyArray<GridTable>,
    keyOf: SpreadsheetContext['keyOf']
): ReadonlyMap<string, CellPlace> =>
    new Map(
        Array.from(indexCells(tables, keyOf), ([key, place]) => [
            cellDomId(idScope, key),
            place,
        ])
    )
