import { useId, useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { CellOverrides } from '../cells/cellProps'
import type { AnnotationsState } from '../model/annotations'
import { cellKey } from '../model/types'
import type { CellKey, GridColumn, GridRow, GridTable } from '../model/types'
import type { CellStoreState } from '../store/store'
import {
    createAnnouncer,
    SpreadsheetReactContext,
    useSpreadsheetContext,
} from './context'
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
    /** The live region's announcer, for a consumer that also says outcomes from outside; one of its own by default. */
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

/** The one polite live region, saying what `announce` was given. */
const LiveRegion = () => {
    const { announcements } = useSpreadsheetContext()
    const text = useStore(announcements, (state) => state.text)
    return (
        <div role="status" className="sr-only">
            {text}
        </div>
    )
}

/**
 * What the grid and its cells read: the cell store, what logic says about each cell, the tables and how their cells
 * are keyed, and the one polite live region, rendered after `children`.
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
    const ownScope = `spreadsheet-${useId().replaceAll(':', '')}`
    const [own] = useState(() => ({
        announcer: createAnnouncer(),
        orgUnitNames: names(),
        fileNames: names(),
    }))
    const { announce, announcements } = announcer ?? own.announcer
    const context = useMemo(
        (): SpreadsheetContext => ({
            store: cells,
            effects: annotations,
            idScope: idScope ?? ownScope,
            settings,
            announce,
            announcements,
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
            idScope,
            ownScope,
            settings,
            announce,
            announcements,
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
            <LiveRegion />
        </SpreadsheetReactContext.Provider>
    )
}
