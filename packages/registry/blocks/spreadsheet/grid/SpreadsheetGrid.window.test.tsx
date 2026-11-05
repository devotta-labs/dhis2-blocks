/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { cellKey } from '../model/types'
import {
    control,
    focused,
    makeTable,
    mount,
    nextFrame,
    range,
    visibleBox,
} from './__tests__/gridRig'

const ROWS = range(200, (i) => `Row ${i + 1}`)
const at = (table: string, row: number) => cellKey(`${table}r${row}`, 'c0')
const mounted = (key: string) =>
    document.querySelector(`[id$="-cell-${key}"]`) !== null

/** Scrolls the table's region to its end, and waits for the grid to draw the rows there. */
const scrollToEnd = async (table = 0) => {
    const region = page.getByRole('region').elements()[table]
    region.scrollTop = region.scrollHeight
    await nextFrame()
    await nextFrame()
}

test('draws only the rows near the view, and says where each sits in the whole table', async () => {
    await mount([makeTable({ rows: ROWS })])
    const rows = page.getByRole('row').elements()
    expect(rows.length).toBeLessThan(60)
    expect(
        page.getByRole('table').element().getAttribute('aria-rowcount')
    ).toBe('201')
    expect(
        rows.map((row) => row.getAttribute('aria-rowindex')).slice(0, 3)
    ).toEqual(['1', '2', '3'])
    // The last row stays drawn, so Shift+Tab from after the table lands in it.
    expect(rows.at(-1)?.getAttribute('aria-rowindex')).toBe('201')
    expect(mounted(at('t1', 100))).toBe(false)
})

test('Enter walks down past the rows first drawn, each cell in view as it gets focus', async () => {
    await mount([makeTable({ rows: ROWS })])
    control(at('t1', 0)).focus()
    for (let row = 1; row <= 40; row += 1) {
        await userEvent.keyboard('{Enter}')
        expect(focused()).toMatch(new RegExp(`-cell-${at('t1', row)}$`))
    }
    expect((await visibleBox(control(at('t1', 40)))).height).toBeGreaterThan(0)
})

test('the row the person is in stays drawn when its table scrolls away from it', async () => {
    await mount([makeTable({ rows: ROWS })])
    control(at('t1', 3)).focus()
    await scrollToEnd()
    expect(mounted(at('t1', 199))).toBe(true)
    expect(focused()).toMatch(new RegExp(`-cell-${at('t1', 3)}$`))
})

test('undo goes to a cell whose row is not drawn', async () => {
    const { value } = await mount([makeTable({ rows: ROWS })])
    control(at('t1', 5)).focus()
    await userEvent.keyboard('5{Enter}')
    expect(value(at('t1', 5))).toBe('5')
    await scrollToEnd()
    control(at('t1', 199)).focus()
    await nextFrame()
    expect(mounted(at('t1', 5))).toBe(false)
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(value(at('t1', 5))).toBeUndefined()
    expect(focused()).toMatch(new RegExp(`-cell-${at('t1', 5)}$`))
    expect((await visibleBox(control(at('t1', 5)))).height).toBeGreaterThan(0)
})

test('the arrows cross from the last row of one long table to the first of the next, and back', async () => {
    await mount([
        makeTable({ id: 't1', rows: ROWS.slice(0, 100) }),
        makeTable({ id: 't2', rows: ROWS.slice(0, 100) }),
    ])
    control(at('t1', 99)).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(focused()).toMatch(new RegExp(`-cell-${at('t2', 0)}$`))
    await userEvent.keyboard('{ArrowUp}')
    expect(focused()).toMatch(new RegExp(`-cell-${at('t1', 99)}$`))
})
