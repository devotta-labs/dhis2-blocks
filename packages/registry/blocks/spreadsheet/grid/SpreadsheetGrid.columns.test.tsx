/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { cellKey } from '../model/types'
import {
    control,
    focused,
    makeTable,
    mount,
    nextFrame,
    paste,
    range,
    visibleBox,
} from './__tests__/gridRig'

// Every fifth heading is one long word, so its column is wider than the least a column takes.
const COLUMNS = range(80, (i) =>
    i % 5 === 4 ? `Haemoglobinconcentration${i + 1}` : `Column ${i + 1}`
)
const ROWS = range(30, (i) => `Row ${i + 1}`)
const at = (row: number, column: number) => cellKey(`t1r${row}`, `c${column}`)
const mounted = (key: string) =>
    document.querySelector(`[id$="-cell-${key}"]`) !== null
const region = () => page.getByRole('region').element()

/** Waits for the grid to draw and measure the columns where the region has scrolled. */
const settled = async () => {
    for (let frame = 0; frame < 4; frame += 1) {
        await nextFrame()
    }
}

/** Scrolls the region to its end sideways, whichever way the page reads. */
const scrollToEnd = async () => {
    const sign = getComputedStyle(region()).direction === 'rtl' ? -1 : 1
    region().scrollLeft = sign * region().scrollWidth
    await settled()
}

/** Runs a test with the page reading in a direction. */
const reading = async (dir: string, run: () => Promise<void>) => {
    document.documentElement.dir = dir
    try {
        await run()
    } finally {
        document.documentElement.dir = ''
    }
}

test('draws only the columns near the view, the same in every row, and says where each sits in the whole table', async () => {
    await mount([makeTable({ columns: COLUMNS, rows: ROWS })])
    await settled()
    const table = page.getByRole('table').element()
    expect(table.getAttribute('aria-colcount')).toBe('82')
    const headings = page.getByRole('columnheader').elements()
    expect(headings.length).toBeLessThan(25)
    expect(
        headings.map((heading) => heading.getAttribute('aria-colindex'))
    ).toContain('2')
    // The last column stays drawn, so Shift+Tab from after the table lands in it.
    expect(headings.at(-1)?.getAttribute('aria-colindex')).toBe('81')
    expect(mounted(at(0, 40))).toBe(false)
    const rows = page.getByRole('row').elements().slice(1)
    for (const row of rows) {
        expect(row.querySelectorAll('input')).toHaveLength(headings.length)
    }
    expect(
        control(at(3, 79)).closest('td')?.getAttribute('aria-colindex')
    ).toBe('81')
})

test('a table twice as wide draws no more cells', async () => {
    const cells = async (columns: number) => {
        const screen = await mount([
            makeTable({
                id: `t${columns}`,
                columns: range(columns, (i) => `Column ${i + 1}`),
                rows: ROWS,
            }),
        ])
        await settled()
        return { screen, drawn: document.querySelectorAll('td, th').length }
    }
    const { drawn: narrow } = await cells(60)
    document.body.replaceChildren()
    const { drawn: wide } = await cells(120)
    expect(wide).toBe(narrow)
})

test.each(['ltr', 'rtl'])(
    '%s: the arrow walks along a row past the columns first drawn, each cell in view as it gets focus',
    (dir) =>
        reading(dir, async () => {
            await mount([makeTable({ columns: COLUMNS, rows: ROWS })])
            control(at(2, 0)).focus()
            const forward = dir === 'rtl' ? '{ArrowLeft}' : '{ArrowRight}'
            for (let column = 1; column <= 45; column += 1) {
                await userEvent.keyboard(forward)
                expect(focused()).toMatch(new RegExp(`-cell-${at(2, column)}$`))
            }
            await settled()
            const box = await visibleBox(control(at(2, 45)))
            expect(box.width).toBeGreaterThan(100)
            // The sticky row header and actions column stay at the region's edges.
            const header = await visibleBox(
                page
                    .getByRole('rowheader', { name: 'Row 3', exact: true })
                    .element()
            )
            expect(header.width).toBeGreaterThan(0)
        })
)

test('Tab walks along a row past the columns first drawn', async () => {
    await mount([makeTable({ columns: COLUMNS, rows: ROWS })])
    control(at(2, 0)).focus()
    for (let column = 1; column <= 30; column += 1) {
        await userEvent.keyboard('{Tab}')
        expect(focused()).toMatch(new RegExp(`-cell-${at(2, column)}$`))
    }
    // From the row's last cell Tab goes on to the next row's first.
    control(at(2, 79)).focus()
    await userEvent.keyboard('{Tab}')
    expect(focused()).toMatch(new RegExp(`-cell-${at(3, 0)}$`))
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    expect(focused()).toMatch(new RegExp(`-cell-${at(2, 79)}$`))
})

test.each(['ltr', 'rtl'])(
    '%s: the column the person is in stays drawn when its table scrolls away from it, and the columns there are drawn',
    (dir) =>
        reading(dir, async () => {
            await mount([makeTable({ columns: COLUMNS, rows: ROWS })])
            control(at(3, 1)).focus()
            await scrollToEnd()
            expect(Math.abs(region().scrollLeft)).toBeGreaterThan(5_000)
            expect(mounted(at(3, 78))).toBe(true)
            expect(mounted(at(3, 40))).toBe(false)
            expect(
                (await visibleBox(control(at(3, 78)))).width
            ).toBeGreaterThan(100)
            expect(focused()).toMatch(new RegExp(`-cell-${at(3, 1)}$`))
            // The columns between are left out, their width kept: the focused cell is where it was.
            region().scrollLeft = 0
            await settled()
            expect((await visibleBox(control(at(3, 1)))).width).toBeGreaterThan(
                100
            )
        })
)

test.each(['ltr', 'rtl'])(
    '%s: undo goes to a cell whose column is not drawn, and shows it',
    (dir) =>
        reading(dir, async () => {
            const { store, value } = await mount([
                makeTable({ columns: COLUMNS, rows: ROWS }),
            ])
            const far = at(20, 60)
            store.getState().commit(far, '7')
            expect(mounted(far)).toBe(false)
            control(at(0, 0)).focus()
            await userEvent.keyboard('{Control>}z{/Control}')
            expect(value(far)).toBeUndefined()
            expect(focused()).toMatch(new RegExp(`-cell-${far}$`))
            // The columns drawn beside it are measured, wider than they were taken to be: the cell stays in view.
            await settled()
            await settled()
            expect(focused()).toMatch(new RegExp(`-cell-${far}$`))
            expect((await visibleBox(control(far))).width).toBeGreaterThan(100)
        })
)

test('a column keeps the width its heading gives it, drawn or left out', async () => {
    await mount([makeTable({ columns: COLUMNS, rows: ROWS })])
    await settled()
    const widths = new Map<string, number>()
    /** Notes the width of each column drawn; one seen before is as wide as it was. */
    const measure = () => {
        const cells = region().querySelectorAll<HTMLElement>(
            'tbody tr:first-child td[data-column]'
        )
        for (const cell of cells) {
            const { width } = cell.getBoundingClientRect()
            const column = cell.dataset.column ?? ''
            expect(widths.get(column) ?? width).toBe(width)
            widths.set(column, width)
        }
    }
    measure()
    expect(widths.get('0')).toBe(112)
    expect(widths.get('4')).toBeGreaterThan(150)
    // Before the columns further along are drawn, each is taken to be the least a column is wide.
    const taken = region().scrollWidth
    for (let left = 0; left < region().scrollWidth; left += 300) {
        region().scrollLeft = left
        await settled()
        measure()
    }
    expect(widths.size).toBe(80)
    // Once each has been drawn, the table is as wide as its columns between the row headers and the actions.
    const [corner, actions] = region().querySelectorAll('thead td[rowspan]')
    const whole =
        [...widths.values()].reduce((sum, width) => sum + width, 0) +
        corner.getBoundingClientRect().width +
        actions.getBoundingClientRect().width
    expect(region().scrollWidth).toBeGreaterThan(taken)
    expect(Math.abs(region().scrollWidth - whole)).toBeLessThan(2)
    // Left out again, they keep their widths.
    region().scrollLeft = 0
    await settled()
    measure()
    expect(Math.abs(region().scrollWidth - whole)).toBeLessThan(2)
})

test('a group heading spans the columns of its own that are drawn', async () => {
    await mount([
        makeTable({
            columns: COLUMNS,
            rows: ROWS,
            groups: [
                { id: 'first', label: 'First', span: 30 },
                { id: 'second', label: 'Second', span: 50 },
            ],
        }),
    ])
    await settled()
    const group = (name: string) => {
        const heading = page
            .getByRole('columnheader', { name, exact: true })
            .element()
        if (!(heading instanceof HTMLTableCellElement)) {
            throw new Error(`No heading ${name}`)
        }
        return heading
    }
    const leaves = () =>
        region().querySelectorAll('thead tr:last-child th').length
    // The first group is drawn over its first columns, the second over the table's last.
    expect(group('First').getAttribute('aria-colindex')).toBe('2')
    // Each says where it starts in the whole table, whichever of its columns are drawn.
    expect(group('Second').getAttribute('aria-colindex')).toBe('32')
    expect(group('First').colSpan + group('Second').colSpan).toBe(leaves())
    await scrollToEnd()
    // Scrolled to the second group, the first keeps the table's first column and the second spans the view.
    expect(group('First').colSpan).toBe(1)
    expect(group('Second').colSpan).toBe(leaves() - 1)
    expect(control(at(0, 79)).getAttribute('aria-labelledby')).toContain(
        group('Second').querySelector('span')?.id
    )
})

test('a block pasted across columns that are not drawn fills them', async () => {
    const { value } = await mount([makeTable({ columns: COLUMNS, rows: ROWS })])
    const cell = control(at(1, 0))
    cell.focus()
    const block = range(60, (i) => String(i + 1)).join('\t')
    expect(paste(cell, block)).toBe(true)
    expect(mounted(at(1, 59))).toBe(false)
    expect(value(at(1, 59))).toBe('60')
    expect(value(at(1, 0))).toBe('1')
})
