import type { CellKey, GridTable, HeaderCell } from '../model/types'

/** The columns of a table that are drawn: those near the view, and the ones the keys reach from where the person is. */
export interface ColumnWindow {
    /** The columns drawn, in the table's order, each with the width of the columns left out before it. */
    drawn: ReadonlyArray<{ index: number; gap: number }>
    /** The width of the columns left out after the last one drawn. */
    after: number
}

/** How many cells a row of the window holds between its header and its actions: the columns and the gaps. */
export const cellCount = ({ drawn, after }: ColumnWindow) =>
    drawn.reduce((count, { gap }) => count + (gap > 0 ? 2 : 1), 0) +
    (after > 0 ? 1 : 0)

/** A run of columns, from one index to another, both counted. */
interface Stretch {
    startIndex: number
    endIndex: number
}

export const NONE_DRAWN: Stretch = { startIndex: 0, endIndex: -1 }

/**
 * The columns to draw near the view: those drawn before for as long as the view is within them, else the view's own
 * and `overscan` more beyond each of its ends. Drawing a few at once and keeping them until the view passes them
 * changes the table once in `overscan` columns scrolled, not at each: every change renders the rows drawn and lays
 * the table out again. A view that narrowed starts over once twice as many columns are drawn beyond it as it would
 * start with; one that shows a column more or less as it scrolls does not.
 */
export const stretchNear = (
    was: Stretch,
    view: Stretch & { overscan: number; count: number }
): Stretch => {
    const { startIndex, endIndex, overscan, count } = view
    const spare = was.endIndex - was.startIndex - (endIndex - startIndex)
    return startIndex >= was.startIndex &&
        endIndex <= was.endIndex &&
        was.endIndex < count &&
        spare <= 4 * overscan
        ? was
        : {
              startIndex: Math.max(startIndex - overscan, 0),
              endIndex: Math.min(endIndex + overscan, count - 1),
          }
}

type KeyOf = (
    row: GridTable['rows'][number],
    column: GridTable['columns'][number]
) => CellKey

/** The nearest column of a row with a control, walking from `from` by `step`, itself not counted. */
const openColumn = (
    table: GridTable,
    keyOf: KeyOf,
    row: number,
    from: number,
    step: 1 | -1
) => {
    const { rows, columns, closed } = table
    if (rows[row] === undefined) {
        return undefined
    }
    for (let c = from + step; c >= 0 && c < columns.length; c += step) {
        if (!closed.has(keyOf(rows[row], columns[c]))) {
            return c
        }
    }
    return undefined
}

/**
 * The columns Tab and Shift+Tab land in, which is the browser's own walk over the controls drawn: the first of the
 * first row and the last of the last, for Tab into the table, and from the cell at `row` and `column` (-1 for the row's
 * header) the next control and the one before, in its row or the row beside it.
 */
export const tabStops = (
    table: GridTable,
    keyOf: KeyOf,
    row: number | undefined,
    column: number
): number[] => {
    const { rows, columns } = table
    const into = [
        openColumn(table, keyOf, 0, -1, 1),
        openColumn(table, keyOf, rows.length - 1, columns.length, -1),
    ]
    const around =
        row === undefined
            ? []
            : [
                  openColumn(table, keyOf, row, column, 1) ??
                      openColumn(table, keyOf, row + 1, -1, 1),
                  openColumn(table, keyOf, row, Math.max(column, 0), -1) ??
                      openColumn(table, keyOf, row - 1, columns.length, -1),
              ]
    return [...into, ...around].flatMap((stop) =>
        stop === undefined ? [] : [stop]
    )
}

/** For each heading row, the heading over each column there: its own, or one from a row above that reaches down. */
export const headingsOver = (
    table: GridTable
): Array<Array<HeaderCell | undefined>> => {
    const over = table.columns.map((): HeaderCell | undefined => undefined)
    const coveredUntil = over.map(() => 0)
    return table.headerRows.map((cells, level) => {
        let column = 0
        for (const cell of cells) {
            while ((coveredUntil[column] ?? 0) > level) {
                column++
            }
            const end = Math.min(column + cell.span, over.length)
            for (; column < end; column++) {
                over[column] = cell
                coveredUntil[column] = level + (cell.rowSpan ?? 1)
            }
        }
        return over.map((cell, c) =>
            coveredUntil[c] > level ? cell : undefined
        )
    })
}

/** A heading as a window draws it, over the drawn columns it covers and the gaps between them. */
export interface DrawnHeading {
    cell: HeaderCell
    /** The first of its columns in the table, drawn or not. */
    start: number
    /** The first and last of its columns that are drawn. */
    first: number
    last: number
    /** The cells of the window it spans. */
    span: number
    /** How many of its columns are drawn. */
    drawn: number
    gap?: undefined
}

/** The width of columns left out between two headings, before the column `before`. */
export interface HeadingGap {
    gap: number
    before: number
}

/**
 * What one heading row of a window holds, in order: each heading that starts in the row and covers a drawn column,
 * spanning the gaps inside it, and a gap wherever columns are left out between two headings. A heading from a row
 * above holds its place in this one.
 */
export const drawnHeadings = (
    over: ReadonlyArray<ReadonlyArray<HeaderCell | undefined>>,
    level: number,
    { drawn, after }: ColumnWindow,
    columns: number
): Array<DrawnHeading | HeadingGap> => {
    const row = over[level] ?? []
    const above = over[level - 1]
    const cells: Array<DrawnHeading | HeadingGap> = []
    let open: DrawnHeading | undefined
    drawn.forEach(({ index, gap }, i) => {
        const cell = row[index]
        const joined =
            i > 0 && cell !== undefined && cell === row[drawn[i - 1].index]
        if (gap > 0 && !joined) {
            cells.push({ gap, before: index })
        }
        // A heading that began in a row above is drawn there.
        if (cell === undefined || above?.[index] === cell) {
            return
        }
        if (joined && open?.cell === cell) {
            open.span += gap > 0 ? 2 : 1
            open.drawn++
            open.last = index
        } else {
            open = {
                cell,
                start: row.indexOf(cell),
                first: index,
                last: index,
                span: 1,
                drawn: 1,
            }
            cells.push(open)
        }
    })
    if (after > 0) {
        cells.push({ gap: after, before: columns })
    }
    return cells
}
