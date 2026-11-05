import { nextCell } from './navigation'
import type { NavGrid } from './navigation'

interface TableSpec {
    rows: number
    columns: number
    /** Cells without a control, as "row,column". */
    closed?: string[]
}

const gridOf = (...specs: TableSpec[]): NavGrid => ({
    tables: specs.map(({ rows, columns, closed = [] }) => ({
        rows,
        columns,
        isOpen: (row, column) => !closed.includes(`${row},${column}`),
        isEditable: (row, column) => !closed.includes(`${row},${column}`),
    })),
})

const at = (table: number, row: number, column: number) => ({
    table,
    row,
    column,
})

test('down skips closed cells', () => {
    const grid = gridOf({ rows: 3, columns: 2, closed: ['1,0'] })
    expect(nextCell(grid, at(0, 0, 0), 'down')).toEqual(at(0, 2, 0))
})

test('up and down move one row in an open column', () => {
    const grid = gridOf({ rows: 3, columns: 2 })
    expect(nextCell(grid, at(0, 1, 1), 'down')).toEqual(at(0, 2, 1))
    expect(nextCell(grid, at(0, 1, 1), 'up')).toEqual(at(0, 0, 1))
})

test('down from the last row continues in the next table', () => {
    const grid = gridOf({ rows: 2, columns: 2 }, { rows: 2, columns: 2 })
    expect(nextCell(grid, at(0, 1, 0), 'down')).toEqual(at(1, 0, 0))
})

test('up from the first row continues at the bottom of the previous table', () => {
    const grid = gridOf({ rows: 2, columns: 2 }, { rows: 3, columns: 2 })
    expect(nextCell(grid, at(1, 0, 1), 'up')).toEqual(at(0, 1, 1))
})

test('moving into a narrower table keeps to its last column', () => {
    const grid = gridOf({ rows: 1, columns: 3 }, { rows: 1, columns: 2 })
    expect(nextCell(grid, at(0, 0, 2), 'down')).toEqual(at(1, 0, 1))
})

test('moving past an empty table carries on to the one after', () => {
    const grid = gridOf(
        { rows: 1, columns: 1 },
        { rows: 0, columns: 1 },
        { rows: 1, columns: 1 }
    )
    expect(nextCell(grid, at(0, 0, 0), 'down')).toEqual(at(2, 0, 0))
    expect(nextCell(grid, at(2, 0, 0), 'up')).toEqual(at(0, 0, 0))
})

test('a column with nothing open further down carries on to the next table', () => {
    const grid = gridOf(
        { rows: 3, columns: 1, closed: ['1,0', '2,0'] },
        { rows: 1, columns: 1 }
    )
    expect(nextCell(grid, at(0, 0, 0), 'down')).toEqual(at(1, 0, 0))
})

test('left and right skip closed cells', () => {
    const grid = gridOf({ rows: 1, columns: 4, closed: ['0,1', '0,2'] })
    expect(nextCell(grid, at(0, 0, 0), 'right')).toEqual(at(0, 0, 3))
    expect(nextCell(grid, at(0, 0, 3), 'left')).toEqual(at(0, 0, 0))
})

test('nothing happens at the outer edge', () => {
    const grid = gridOf({ rows: 2, columns: 2 }, { rows: 2, columns: 2 })
    expect(nextCell(grid, at(1, 0, 1), 'right')).toBeUndefined()
    expect(nextCell(grid, at(0, 0, 0), 'left')).toBeUndefined()
    expect(nextCell(grid, at(0, 0, 0), 'up')).toBeUndefined()
    expect(nextCell(grid, at(1, 1, 0), 'down')).toBeUndefined()
})

test('arrows do not wrap to the next row', () => {
    const grid = gridOf({ rows: 2, columns: 2 })
    expect(nextCell(grid, at(0, 0, 1), 'right')).toBeUndefined()
    expect(nextCell(grid, at(0, 1, 0), 'left')).toBeUndefined()
})

test('read-only cells are open: arrows land on them', () => {
    const grid: NavGrid = {
        tables: [
            {
                rows: 3,
                columns: 1,
                isOpen: () => true,
                isEditable: (row) => row !== 1,
            },
        ],
    }
    expect(nextCell(grid, at(0, 0, 0), 'down')).toEqual(at(0, 1, 0))
})

test('Enter moves down', () => {
    const grid = gridOf({ rows: 3, columns: 3 })
    expect(nextCell(grid, at(0, 0, 1), 'enter')).toEqual(at(0, 1, 1))
})

test('Enter after a Tab run returns to where the run began', () => {
    const grid = gridOf({ rows: 3, columns: 3 })
    expect(nextCell(grid, at(0, 0, 2), 'enter', 0)).toEqual(at(0, 1, 0))
})

test('Enter after a Tab run skips a closed cell in the starting column', () => {
    const grid = gridOf({ rows: 3, columns: 3, closed: ['1,0'] })
    expect(nextCell(grid, at(0, 0, 2), 'enter', 0)).toEqual(at(0, 2, 0))
})

test('Enter after a Tab run into a narrower table stays inside it', () => {
    const grid = gridOf({ rows: 1, columns: 4 }, { rows: 1, columns: 2 })
    expect(nextCell(grid, at(0, 0, 3), 'enter', 3)).toEqual(at(1, 0, 1))
})

test('Enter at the end of the last table does nothing', () => {
    const grid = gridOf({ rows: 2, columns: 2 })
    expect(nextCell(grid, at(0, 1, 0), 'enter')).toBeUndefined()
})

test('Tab is left to the browser: nextCell takes no Tab key', () => {
    const grid = gridOf({ rows: 1, columns: 3 })
    // @ts-expect-error The grid only notes where a run of Tabs began; the browser moves focus.
    expect(nextCell(grid, at(0, 0, 0), 'tab')).toBeUndefined()
})
