import { cellKey } from '../model/types'
import type { GridTable } from '../model/types'
import {
    cellCount,
    drawnHeadings,
    headingsOver,
    NONE_DRAWN,
    stretchNear,
    tabStops,
} from './columnWindow'

const keyOf = (row: { id: string }, column: { id: string }) =>
    cellKey(row.id, column.id)

/** Six columns: `Name` over two heading rows, then a group of three and a group of two. */
const table = (closed: ReadonlyArray<[string, string]> = []): GridTable => ({
    id: 't1',
    title: 'Table t1',
    rows: ['r0', 'r1', 'r2'].map((id) => ({ id, label: id })),
    columns: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'].map((id) => ({
        id,
        label: id,
    })),
    closed: new Map(
        closed.map(([row, column]) => [cellKey(row, column), 'Not used'])
    ),
    headerRows: [
        [
            { id: 'name', label: 'Name', span: 1, rowSpan: 2 },
            { id: 'a', label: 'A', span: 3 },
            { id: 'b', label: 'B', span: 2 },
        ],
        ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => ({
            id,
            label: id,
            span: 1,
        })),
    ],
})

/** A heading row as `drawnHeadings` gives it, each cell by its id and span, each gap by its width. */
const row = (level: number, drawn: Array<[number, number]>, after = 0) =>
    drawnHeadings(
        headingsOver(table()),
        level,
        { drawn: drawn.map(([index, gap]) => ({ index, gap })), after },
        6
    ).map((cell) =>
        cell.gap === undefined ? `${cell.cell.id}×${cell.span}` : cell.gap
    )

test('a heading reaching down holds its column in the rows below', () => {
    expect(
        headingsOver(table()).map((cells) => cells.map((cell) => cell?.id))
    ).toEqual([
        ['name', 'a', 'a', 'a', 'b', 'b'],
        ['name', 'c1', 'c2', 'c3', 'c4', 'c5'],
    ])
})

test('every column drawn: the headings as the table lists them', () => {
    const all: Array<[number, number]> = [0, 1, 2, 3, 4, 5].map((c) => [c, 0])
    expect(row(0, all)).toEqual(['name×1', 'a×3', 'b×2'])
    expect(row(1, all)).toEqual(['c1×1', 'c2×1', 'c3×1', 'c4×1', 'c5×1'])
    expect(
        cellCount({
            drawn: all.map(([index]) => ({ index, gap: 0 })),
            after: 0,
        })
    ).toBe(6)
})

test('a group spans the gap between two of its columns, and shares a gap at its edge', () => {
    // Columns 0, 1, 3 and 5 drawn: column 2 is left out inside A, column 4 between A and B.
    const drawn: Array<[number, number]> = [
        [0, 0],
        [1, 0],
        [3, 112],
        [5, 112],
    ]
    expect(row(0, drawn)).toEqual(['name×1', 'a×3', 112, 'b×1'])
    expect(row(1, drawn)).toEqual(['c1×1', 112, 'c3×1', 112, 'c5×1'])
    expect(
        cellCount({
            drawn: drawn.map(([index, gap]) => ({ index, gap })),
            after: 0,
        })
    ).toBe(6)
})

test('columns left out at the end are one gap in every heading row', () => {
    expect(row(0, [[0, 0]], 560)).toEqual(['name×1', 560])
    expect(row(1, [[0, 0]], 560)).toEqual([560])
})

test('Tab stops: the next and previous control, in the row or the one beside it, and the ends of the table', () => {
    // In the middle of a row: the first and last cells of the table, and the cells either side.
    expect(tabStops(table(), keyOf, 1, 2)).toEqual([0, 5, 3, 1])
    // At a row's end Tab goes to the next row's first control, Shift+Tab from its start to the last of the row above.
    expect(tabStops(table(), keyOf, 1, 5)).toEqual([0, 5, 0, 4])
    expect(tabStops(table(), keyOf, 1, 0)).toEqual([0, 5, 1, 5])
    // From the row's header, Tab goes to its first control.
    expect(tabStops(table(), keyOf, 1, -1)).toEqual([0, 5, 0, 5])
    // Closed cells have no control: Tab passes them.
    const closed = table([
        ['r0', 'c0'],
        ['r1', 'c3'],
        ['r1', 'c4'],
        ['r2', 'c5'],
    ])
    expect(tabStops(closed, keyOf, 1, 2)).toEqual([1, 4, 5, 1])
    // No cell noted: only the ends of the table.
    expect(tabStops(table(), keyOf, undefined, -1)).toEqual([0, 5])
})

describe('stretchNear', () => {
    const view = (startIndex: number, endIndex: number, count = 40) => ({
        startIndex,
        endIndex,
        overscan: 3,
        count,
    })

    it('draws the view and a few columns beyond each end, within the table', () => {
        expect(stretchNear(NONE_DRAWN, view(0, 9))).toEqual({
            startIndex: 0,
            endIndex: 12,
        })
        expect(stretchNear(NONE_DRAWN, view(30, 39))).toEqual({
            startIndex: 27,
            endIndex: 39,
        })
    })

    it('keeps the columns drawn while the view is within them', () => {
        const drawn = stretchNear(NONE_DRAWN, view(10, 19))

        expect(stretchNear(drawn, view(7, 16))).toBe(drawn)
        expect(stretchNear(drawn, view(13, 22))).toBe(drawn)
    })

    it('draws anew around a view that passed the columns drawn, either way', () => {
        const drawn = stretchNear(NONE_DRAWN, view(10, 19))

        expect(stretchNear(drawn, view(14, 23))).toEqual({
            startIndex: 11,
            endIndex: 26,
        })
        expect(stretchNear(drawn, view(6, 15))).toEqual({
            startIndex: 3,
            endIndex: 18,
        })
    })

    it('draws anew when the view narrowed to far fewer columns than are drawn', () => {
        const drawn = stretchNear(NONE_DRAWN, view(10, 29))

        expect(stretchNear(drawn, view(12, 25))).toBe(drawn)
        expect(stretchNear(drawn, view(12, 24))).toEqual({
            startIndex: 9,
            endIndex: 27,
        })
    })

    it('draws anew when the table lost the last columns drawn', () => {
        const drawn = stretchNear(NONE_DRAWN, view(30, 39))

        expect(stretchNear(drawn, view(28, 34, 35))).toEqual({
            startIndex: 25,
            endIndex: 34,
        })
    })
})
