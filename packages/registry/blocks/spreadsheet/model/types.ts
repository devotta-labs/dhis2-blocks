/** A cell's key: its two parts joined by a dot, `<first>.<second>`; the first part contains no dot. */
export type CellKey = `${string}.${string}`

export const cellKey = (first: string, second: string): CellKey =>
    `${first}.${second}`

export interface GridRow {
    id: string
    /** Names the row in its header, unless the provider's `RowLabel` names it otherwise. */
    label: string
    /** Names the row by these cells' values, joined by a space. */
    labelFrom?: ReadonlyArray<CellKey>
}

export interface GridColumn {
    id: string
    label: string
}

export interface HeaderCell {
    id: string
    label: string
    /** How many columns the heading covers. */
    span: number
    /**
     * How many heading rows it covers, its own and the ones below (default 1); those rows list no cell for its
     * columns.
     */
    rowSpan?: number
}

export interface GridTable<
    R extends GridRow = GridRow,
    C extends GridColumn = GridColumn,
> {
    id: string
    title: string
    rows: R[]
    columns: C[]
    headerRows: HeaderCell[][]
    /** Cells with no control, skipped by the arrows, with their reason ("Not used"). */
    closed: ReadonlyMap<CellKey, string>
}

export type SyncState =
    | 'idle'
    | 'queued'
    | 'sending'
    | 'saved'
    | 'waiting'
    | 'failed'

export interface CellState {
    /** What DHIS2 had when the cell was loaded or last confirmed. */
    base?: string
    value?: string
    /** Text that failed checking, kept so nothing typed is lost. */
    draft?: string
    error?: string
    /** A saved value that breaks the field's rules; set on load, never blocks. */
    warning?: string
    sync: SyncState
    /** Why the cell is `waiting` or `failed`. */
    reason?: string
    source: 'person' | 'rule'
}

export type CommitResult = 'invalid' | 'unchanged' | 'queued'

export interface CellPlace {
    table: number
    row: number
    column: number
}

/** Where every open cell of the tables is, by the key `keyOf` gives it. */
export const indexCells = <R extends GridRow, C extends GridColumn>(
    tables: ReadonlyArray<GridTable<R, C>>,
    keyOf: (row: R, column: C) => CellKey
): ReadonlyMap<CellKey, CellPlace> => {
    const index = new Map<CellKey, CellPlace>()
    tables.forEach(({ id, rows, columns, closed }, table) => {
        // Closed cells count too: a key two cells of a table share is a layout error, wherever it shows.
        const seen = new Set<CellKey>()
        rows.forEach((gridRow, row) => {
            columns.forEach((gridColumn, column) => {
                const key = keyOf(gridRow, gridColumn)
                if (seen.has(key)) {
                    throw new Error(
                        `Two cells of the table ${id} save to ${key}`
                    )
                }
                seen.add(key)
                if (!closed.has(key)) {
                    index.set(key, { table, row, column })
                }
            })
        })
    })
    return index
}
