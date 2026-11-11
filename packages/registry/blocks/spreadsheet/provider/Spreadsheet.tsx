import { useCallback, useId, useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { announce as sharedAnnounce } from '@/components/dhis2/ui/announcer'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { cellDomId } from '../cells/cellProps'
import type { CellOverrides } from '../cells/cellProps'
import type { AnnotationsState } from '../model/annotations'
import { cellKey } from '../model/types'
import type { CellKey, GridColumn, GridRow, GridTable } from '../model/types'
import type { CellStoreState } from '../store/store'
import { SpreadsheetReactContext } from './context'
import type { Announcer, ReadonlyStore, SpreadsheetContext } from './context'

type Names = SpreadsheetContext['orgUnitNames']

interface SpreadsheetProps<R extends GridRow, C extends GridColumn> {
    /** The cells' values and states, from `createCellStore`. */
    cells: StoreApi<CellStoreState>
    /** What logic says about each cell and row: the consumer's own store, of this shape or a richer one. */
    annotations: ReadonlyStore<AnnotationsState>
    tables: ReadonlyArray<GridTable<R, C>>
    /** The key of the row's cell in the column; `cellKey(row.id, column.id)` by default. */
    keyOf?(row: R, column: C): CellKey
    /** The keys the row's messages and notes are stored under in `annotations`; `[row.id]` by default. */
    rowKeysOf?(row: R): ReadonlyArray<string>
    settings: ValueSettings
    /** Starts every DOM id of the spreadsheet, so two on one page never share one; one of its own by default. */
    idScope?: string
    /** Controls that replace the default ones; keep the object stable, or every cell renders again. */
    overrides?: CellOverrides
    addRow?: SpreadsheetContext['addRow']
    /** Names of org units by id, for org unit cells; a store of its own by default. */
    orgUnitNames?: Names
    /** Names of files by id, for file cells; a store of its own by default. */
    fileNames?: Names
    /** Whether the server cannot be reached now: files cannot be uploaded. */
    offline?: boolean
    fileUrl?: SpreadsheetContext['fileUrl']
    /** Says the grid's outcomes to screen reader users; the shared `announce` by default. */
    announcer?: Announcer
    RowLabel?: ComponentType<{ row: R }>
    RowBadge?: SpreadsheetContext['RowBadge']
    GridFooter?: SpreadsheetContext['GridFooter']
    /** Whether the column's cells take row and column actions; every column by default. */
    bulkColumn?(column: C): boolean
    confirmBulk?: SpreadsheetContext['confirmBulk']
    children: ReactNode
}

const byIds = (row: GridRow, column: GridColumn) => cellKey(row.id, column.id)
const ownId = (row: GridRow) => [row.id]
const names = (): Names =>
    createStore<{ names: ReadonlyMap<string, string> }>()(() => ({
        names: new Map(),
    }))

const inView = (element: HTMLElement) => {
    const box = element.getBoundingClientRect()
    let bounds = {
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
        left: 0,
    }
    for (
        let ancestor = element.parentElement;
        ancestor !== null;
        ancestor = ancestor.parentElement
    ) {
        const style = getComputedStyle(ancestor)
        const clipsX = /^(auto|clip|hidden|overlay|scroll)$/.test(
            style.overflowX
        )
        const clipsY = /^(auto|clip|hidden|overlay|scroll)$/.test(
            style.overflowY
        )
        if (!clipsX && !clipsY) {
            continue
        }
        const parent = ancestor.getBoundingClientRect()
        const padding = (value: string) => Number.parseFloat(value) || 0
        bounds = {
            top: clipsY
                ? Math.max(
                      bounds.top,
                      parent.top +
                          ancestor.clientTop +
                          padding(style.scrollPaddingTop)
                  )
                : bounds.top,
            right: clipsX
                ? Math.min(
                      bounds.right,
                      parent.left +
                          ancestor.clientLeft +
                          ancestor.clientWidth -
                          padding(style.scrollPaddingRight)
                  )
                : bounds.right,
            bottom: clipsY
                ? Math.min(
                      bounds.bottom,
                      parent.top +
                          ancestor.clientTop +
                          ancestor.clientHeight -
                          padding(style.scrollPaddingBottom)
                  )
                : bounds.bottom,
            left: clipsX
                ? Math.max(
                      bounds.left,
                      parent.left +
                          ancestor.clientLeft +
                          padding(style.scrollPaddingLeft)
                  )
                : bounds.left,
        }
    }
    return (
        box.top >= bounds.top &&
        box.right <= bounds.right &&
        box.bottom <= bounds.bottom &&
        box.left >= bounds.left
    )
}

const focusElementWithoutScroll = (cell: HTMLElement) => {
    const scroll = !inView(cell)
    cell.focus({ preventScroll: true })
    if (scroll) {
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
}

/**
 * What the grid and its cells read: the cell store, what logic says about each cell, the tables and how their cells
 * are keyed, and how outcomes are announced.
 */
export const Spreadsheet = <R extends GridRow, C extends GridColumn>({
    cells,
    annotations,
    tables,
    keyOf = byIds,
    rowKeysOf = ownId,
    settings,
    idScope,
    overrides,
    addRow,
    orgUnitNames,
    fileNames,
    offline = false,
    fileUrl,
    announcer,
    RowLabel,
    RowBadge,
    GridFooter,
    bulkColumn,
    confirmBulk,
    children,
}: SpreadsheetProps<R, C>) => {
    const id = useId()
    const ownScope = `spreadsheet-${id.replaceAll(':', '')}`
    const [own] = useState(() => ({
        orgUnitNames: names(),
        fileNames: names(),
        focusing: createStore<{ key?: CellKey }>()(() => ({})),
    }))
    const announce = announcer?.announce ?? sharedAnnounce
    const scope = idScope ?? ownScope
    const focusCell = useCallback(
        (key: CellKey) => {
            const cell = document.getElementById(cellDomId(scope, key))
            if (cell === null) {
                own.focusing.setState({ key })
            } else {
                focusElementWithoutScroll(cell)
            }
        },
        [scope, own]
    )
    const context = useMemo(
        (): SpreadsheetContext => ({
            store: cells,
            effects: annotations,
            idScope: scope,
            settings,
            announce,
            focusCell,
            focusing: own.focusing,
            tables,
            keyOf,
            rowKeysOf,
            addRow,
            // SAFETY: the grid hands the label only rows of `tables`, which are `R`s.
            RowLabel: RowLabel as SpreadsheetContext['RowLabel'],
            RowBadge,
            GridFooter,
            // SAFETY: the grid hands it only columns of `tables`, which are `C`s.
            bulkColumn: bulkColumn as SpreadsheetContext['bulkColumn'],
            confirmBulk,
            offline,
            fileUrl,
            overrides,
            orgUnitNames: orgUnitNames ?? own.orgUnitNames,
            fileNames: fileNames ?? own.fileNames,
        }),
        [
            cells,
            annotations,
            scope,
            settings,
            announce,
            focusCell,
            tables,
            keyOf,
            rowKeysOf,
            addRow,
            RowLabel,
            RowBadge,
            GridFooter,
            bulkColumn,
            confirmBulk,
            offline,
            fileUrl,
            overrides,
            orgUnitNames,
            fileNames,
            own,
        ]
    )
    return (
        <SpreadsheetReactContext.Provider value={context}>
            {children}
        </SpreadsheetReactContext.Provider>
    )
}
