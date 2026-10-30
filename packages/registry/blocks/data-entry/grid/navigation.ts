export interface CellPosition {
    table: number
    row: number
    column: number
}

export type NavKey = 'up' | 'down' | 'left' | 'right' | 'enter' | 'tab'

export interface NavGrid {
    tables: ReadonlyArray<{
        rows: number
        columns: number
        /**
         * Takes focus: arrows land on it, read-only cells included. Closed cells are skipped. Called once per cell
         * stepped over, so it must be a constant-time lookup.
         */
        isOpen(row: number, column: number): boolean
        /** Takes a typed or pasted value; an editable cell is always open. */
        isEditable(row: number, column: number): boolean
    }>
}

const sideways = (
    grid: NavGrid,
    { table, row, column }: CellPosition,
    step: 1 | -1
): CellPosition | undefined => {
    const { columns, isOpen } = grid.tables[table]
    for (let next = column + step; next >= 0 && next < columns; next += step) {
        if (isOpen(row, next)) return { table, row, column: next }
    }
}

// A narrower table keeps the nearest column, so moving down never skips a table.
const vertical = (
    grid: NavGrid,
    from: CellPosition,
    step: 1 | -1
): CellPosition | undefined => {
    let { table, row } = from
    for (row += step; ; row += step) {
        while (row < 0 || row >= grid.tables[table].rows) {
            table += step
            if (table < 0 || table >= grid.tables.length) return undefined
            row = step > 0 ? 0 : grid.tables[table].rows - 1
        }
        const { columns, isOpen } = grid.tables[table]
        const column = Math.min(from.column, columns - 1)
        if (column >= 0 && isOpen(row, column)) return { table, row, column }
    }
}

/**
 * Where focus goes; `tabStart` is the column a run of Tab presses began in (Excel's Tab-then-Enter). The caller
 * keeps it: set on the first Tab, cleared by Enter, an arrow, a click or typing. Tab itself is the browser's.
 */
export const nextCell = (
    grid: NavGrid,
    from: CellPosition,
    key: Exclude<NavKey, 'tab'>,
    tabStart?: number
): CellPosition | undefined => {
    switch (key) {
        case 'up':
            return vertical(grid, from, -1)
        case 'down':
            return vertical(grid, from, 1)
        case 'left':
            return sideways(grid, from, -1)
        case 'right':
            return sideways(grid, from, 1)
        case 'enter':
            return vertical(
                grid,
                { ...from, column: tabStart ?? from.column },
                1
            )
    }
}
