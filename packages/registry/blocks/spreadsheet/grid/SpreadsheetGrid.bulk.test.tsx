/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { cellDomId } from '../cells/cellProps'
import { cellKey } from '../model/types'
import type { CellKey } from '../model/types'
import {
    control,
    focused,
    ID_SCOPE,
    makeTable,
    mount,
    nextFrame,
    range,
} from './__tests__/gridRig'

const items = () =>
    page
        .getByRole('menuitem')
        .elements()
        .map((item) => item.textContent)

/** A context menu raised from the keyboard (Shift+F10, the Menu key), on the element; whether the grid took it. */
const contextMenu = (target: Element) => {
    const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
    })
    target.dispatchEvent(event)
    return event.defaultPrevented
}

const ROWS = ['a', 'b', 'c']

test('a row’s menu copies to the rows below, and the last row’s only clears', async () => {
    await mount([makeTable({ rows: ROWS })])
    await page.getByRole('button', { name: 'Row actions a' }).click()
    await expect
        .poll(items)
        .toEqual(['Apply to next row', 'Apply to all rows below', 'Clear row'])
    await userEvent.keyboard('{Escape}')
    await page.getByRole('button', { name: 'Row actions c' }).click()
    await expect.poll(items).toEqual(['Clear row'])
})

test('a column’s menu applies to or clears its cells', async () => {
    await mount([makeTable({ columns: ['A'], rows: ROWS })])
    await page.getByRole('button', { name: 'Column actions A' }).click()
    await expect
        .poll(items)
        .toEqual(['Apply value to all column cells', 'Clear all column cells'])
})

test('no column button for a column left out of bulk actions or holding several fields', async () => {
    await mount(
        [
            makeTable({
                columns: ['A', 'B', 'C'],
                fields: [{ valueType: 'TEXT' }],
                rows: ROWS,
            }),
        ],
        {
            bulkColumn: (column) => column.id !== 'c1',
            // Row b's cell in C is A's field.
            fieldIdOf: (key) =>
                key === cellKey('t1r1', 'c2')
                    ? 'c0'
                    : key.slice(key.indexOf('.') + 1),
        }
    )
    await expect
        .element(page.getByRole('button', { name: 'Column actions A' }))
        .toBeInTheDocument()
    expect(
        page.getByRole('button', { name: /^Column actions/ }).elements()
    ).toHaveLength(1)
})

test('the buttons are out of the Tab order and their names do not reach the cells', async () => {
    await mount([makeTable({ columns: ['A'], rows: ['a'] })])
    for (const name of ['Row actions a', 'Column actions A']) {
        await expect
            .element(page.getByRole('button', { name }))
            .toHaveAttribute('tabindex', '-1')
    }
    await expect
        .element(page.getByRole('textbox', { name: 'A a' }))
        .toBeVisible()
})

test('a row copy fills the empty cells of the next row and says how many changed', async () => {
    const at = (row: number, column: number) =>
        cellKey(`t1r${row}`, `c${column}`)
    const { value, announced } = await mount(
        [makeTable({ columns: ['A', 'B', 'C', 'D'], rows: ROWS })],
        {
            values: [
                [at(0, 0), '1'],
                [at(0, 1), '2'],
                [at(0, 2), '3'],
                [at(0, 3), '4'],
                [at(1, 3), '9'],
            ],
        }
    )
    await page.getByRole('button', { name: 'Row actions a' }).click()
    await page.getByRole('menuitem', { name: 'Apply to next row' }).click()
    expect([0, 1, 2, 3].map((c) => value(at(1, c)))).toEqual([
        '1',
        '2',
        '3',
        '9',
    ])
    // The row after it is not the next row.
    expect(value(at(2, 0))).toBeUndefined()
    expect(announced).toEqual(['Cells changed: 3'])
})

test('a locked row is skipped and counted in the summary', async () => {
    const at = (row: number, column: number) =>
        cellKey(`t1r${row}`, `c${column}`)
    const { value, announced } = await mount(
        [makeTable({ columns: ['A', 'B'], rows: ROWS })],
        {
            values: [
                [at(0, 0), '1'],
                [at(0, 1), '2'],
            ],
            effects: {
                [at(1, 0)]: { readOnly: 'Completed' },
                [at(1, 1)]: { readOnly: 'Completed' },
            },
        }
    )
    await page.getByRole('button', { name: 'Row actions a' }).click()
    await page
        .getByRole('menuitem', { name: 'Apply to all rows below' })
        .click()
    expect([value(at(1, 0)), value(at(1, 1))]).toEqual([undefined, undefined])
    expect([value(at(2, 0)), value(at(2, 1))]).toEqual(['1', '2'])
    expect(announced).toEqual(['Cells changed: 2 2 skipped: Completed.'])
})

test('a bulk write the provider asks about waits for the answer', async () => {
    const keys = [cellKey('t1r0', 'c0'), cellKey('t1r0', 'c1')]
    const confirmBulk = vi.fn((_keys: ReadonlyArray<CellKey>) => ({
        title: 'Create events?',
        body: 'This creates 1 events on this page.',
        confirm: 'Create events',
    }))
    const { value, announced } = await mount(
        [makeTable({ columns: ['A', 'B'], rows: ROWS })],
        {
            values: [
                [keys[0], '1'],
                [keys[1], '2'],
            ],
            confirmBulk,
        }
    )
    const clear = async () => {
        await page.getByRole('button', { name: 'Row actions a' }).click()
        await page.getByRole('menuitem', { name: 'Clear row' }).click()
    }
    await clear()
    expect(confirmBulk).toHaveBeenLastCalledWith(keys)
    const dialog = page.getByRole('alertdialog', { name: 'Create events?' })
    await expect
        .element(dialog)
        .toHaveAccessibleDescription('This creates 1 events on this page.')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    expect(keys.map(value)).toEqual(['1', '2'])
    expect(announced).toEqual([])

    await clear()
    await dialog.getByRole('button', { name: 'Create events' }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    expect(keys.map(value)).toEqual([undefined, undefined])
    expect(announced).toEqual(['Cells changed: 2'])
})

test('a context menu on a cell, from the keyboard or a right click, holds its row’s and its column’s actions', async () => {
    await mount([makeTable({ columns: ['A', 'B'], rows: ROWS })])
    const cell = control(cellKey('t1r1', 'c0'))
    cell.focus()
    expect(contextMenu(cell)).toBe(true)
    const row = page.getByRole('group', { name: 'Row' })
    const column = page.getByRole('group', { name: 'Column' })
    await expect
        .element(row.getByRole('menuitem', { name: 'Apply to next row' }))
        .toBeVisible()
    await expect
        .element(
            column.getByRole('menuitem', { name: 'Clear all column cells' })
        )
        .toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(row).not.toBeInTheDocument()
    expect(focused()).toBe(cell.id)

    // A right click on the selected cell opens it too, rather than starting to edit.
    await userEvent.click(cell, { button: 'right' })
    await expect.element(row).toBeVisible()
    await expect.element(column).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(row).not.toBeInTheDocument()
    expect(focused()).toBe(cell.id)
    await expect.element(cell).toHaveAttribute('data-mode', 'ready')
})

test('a context menu in a cell being typed in is the browser’s', async () => {
    await mount([makeTable({ rows: ROWS })])
    const cell = control(cellKey('t1r0', 'c0'))
    cell.focus()
    await userEvent.keyboard('4')
    expect(contextMenu(cell)).toBe(false)
    expect(contextMenu(page.getByRole('region').element())).toBe(false)
})

test('one undo after a column action restores every cell and focuses the first', async () => {
    const keys = ROWS.map((_, i) => cellKey(`t1r${i}`, 'c0'))
    const { value, announced } = await mount(
        [makeTable({ columns: ['A', 'B'], rows: ROWS })],
        {
            values: keys.map((key, i): [CellKey, string] => [key, `${i + 1}`]),
        }
    )
    const last = control(keys[2])
    last.focus()
    contextMenu(last)
    await page.getByRole('menuitem', { name: 'Clear all column cells' }).click()
    expect(keys.map(value)).toEqual([undefined, undefined, undefined])
    expect(announced).toEqual(['Cells changed: 3'])
    await expect.poll(focused).toBe(last.id)
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(keys.map(value)).toEqual(['1', '2', '3'])
    expect(focused()).toBe(cellDomId(ID_SCOPE, keys[0]))
})

test('the last column, focused while scrolled, is not hidden under the sticky actions column', async () => {
    await mount([
        makeTable({ columns: range(12, (i) => `Column ${i}`), rows: ['a'] }),
    ])
    const region = page.getByRole('region').element()
    const actions = page
        .getByRole('button', { name: 'Row actions a' })
        .element()
        .closest('td')
    if (actions === null) {
        throw new Error('No actions cell')
    }
    expect(getComputedStyle(actions).position).toBe('sticky')
    // The last column half under the actions column, then focused.
    const target = control(cellKey('t1r0', 'c11'))
    region.scrollLeft = 0
    region.scrollLeft +=
        target.getBoundingClientRect().right -
        actions.getBoundingClientRect().left -
        target.getBoundingClientRect().width / 2
    await nextFrame()
    expect(target.getBoundingClientRect().right).toBeGreaterThan(
        actions.getBoundingClientRect().left + 1
    )
    target.focus()
    await nextFrame()
    expect(target.getBoundingClientRect().right).toBeLessThanOrEqual(
        actions.getBoundingClientRect().left + 1
    )
})
