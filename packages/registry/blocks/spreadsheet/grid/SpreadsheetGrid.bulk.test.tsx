import { cellAt } from '@/components/spreadsheet'
/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import type { Field } from '@/components/dhis2-value-types'
import { cellDomId } from '../cells/cellProps'
import type { CellComponent } from '../cells/cellProps'
import { useCellContext } from '../cells/CellStatus'
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
import { headerDomId } from './headers'

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
    expect(announced).toEqual(['Cells changed: 3.'])
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
    expect(announced).toEqual(['Cells changed: 2. 2 skipped: Completed.'])
})

test('a row copy leaves out a value the person cannot see', async () => {
    const at = (row: number, column: number) =>
        cellKey(`t1r${row}`, `c${column}`)
    const { value, announced } = await mount(
        [makeTable({ columns: ['A', 'B'], rows: ROWS })],
        {
            values: [
                [at(0, 0), '1'],
                [at(0, 1), '2'],
            ],
            effects: { [at(0, 0)]: { hiddenBy: 'Hidden by a rule' } },
        }
    )
    await page.getByRole('button', { name: 'Row actions a' }).click()
    await page
        .getByRole('menuitem', { name: 'Apply to all rows below' })
        .click()
    expect([1, 2].map((row) => value(at(row, 0)))).toEqual([
        undefined,
        undefined,
    ])
    expect([1, 2].map((row) => value(at(row, 1)))).toEqual(['2', '2'])
    expect(announced).toEqual(['Cells changed: 2.'])
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
    await page.getByRole('button', { name: 'Row actions a' }).click()
    await page.getByRole('menuitem', { name: 'Clear row' }).click()
    expect(confirmBulk).toHaveBeenLastCalledWith(keys)
    const dialog = page.getByRole('alertdialog', { name: 'Create events?' })
    await expect
        .element(dialog)
        .toHaveAccessibleDescription('This creates 1 events on this page.')
    const button = page.getByRole('button', { name: 'Row actions a' })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    expect(keys.map(value)).toEqual(['1', '2'])
    expect(announced).toEqual([])
    await expect.element(button).toHaveFocus()

    // From a cell's context menu, focus goes back to the cell, where Ctrl+Z undoes.
    const cell = control(keys[0])
    cell.focus()
    contextMenu(cell)
    await page.getByRole('menuitem', { name: 'Clear row' }).click()
    await dialog.getByRole('button', { name: 'Create events' }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    expect(keys.map(value)).toEqual([undefined, undefined])
    expect(announced).toEqual(['Cells changed: 2.'])
    await expect.element(cell).toHaveFocus()
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(keys.map(value)).toEqual(['1', '2'])
})

test('a clear drops a cell’s refused text and counts it as changed', async () => {
    const key = cellKey('t1r0', 'c0')
    const { store, announced } = await mount([makeTable({ rows: ROWS })])
    expect(store.getState().commit(key, 'abc')).toBe('invalid')
    await page.getByRole('button', { name: 'Row actions a' }).click()
    await page.getByRole('menuitem', { name: 'Clear row' }).click()
    expect(cellAt(store.getState().cells, key)?.draft).toBeUndefined()
    expect(announced).toEqual(['Cells changed: 1.'])
})

test('a cell the store keeps locked, unmarked in the annotations, is counted as skipped', async () => {
    const at = (row: number, column: number) =>
        cellKey(`t1r${row}`, `c${column}`)
    const { value, announced } = await mount(
        [makeTable({ columns: ['A', 'B'], rows: ROWS })],
        {
            values: [
                [at(0, 0), '1'],
                [at(0, 1), '2'],
            ],
            locked: (key) => key === at(1, 0),
        }
    )
    await page.getByRole('button', { name: 'Row actions a' }).click()
    await page.getByRole('menuitem', { name: 'Apply to next row' }).click()
    expect([value(at(1, 0)), value(at(1, 1))]).toEqual([undefined, '2'])
    expect(announced).toEqual([
        'Cells changed: 1. 1 skipped: This cell cannot be changed.',
    ])
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

    // Ctrl+click is a Mac's right click: it does not start editing either.
    await userEvent.click(cell, { modifiers: ['Control'] })
    await expect.element(cell).toHaveAttribute('data-mode', 'ready')
})

test('Ctrl+Shift+\\ (Cmd+Shift+\\ on Apple keyboards) on a cell opens its menu, as a context menu does', async () => {
    await mount([makeTable({ columns: ['A', 'B'], rows: ROWS })])
    const apple = /Mac|iPhone|iPad/.test(navigator.platform)
    // Matched on the key's place, whatever the layout prints on it.
    const press = (target: Element) => {
        const event = new KeyboardEvent('keydown', {
            code: 'Backslash',
            key: '#',
            shiftKey: true,
            ctrlKey: !apple,
            metaKey: apple,
            bubbles: true,
            cancelable: true,
        })
        target.dispatchEvent(event)
        return event.defaultPrevented
    }
    const cell = control(cellKey('t1r1', 'c0'))
    cell.focus()
    expect(press(cell)).toBe(true)
    await expect.element(page.getByRole('group', { name: 'Row' })).toBeVisible()
    await expect
        .element(page.getByRole('group', { name: 'Column' }))
        .toBeVisible()
    await userEvent.keyboard('{Escape}')
    expect(focused()).toBe(cell.id)
    await userEvent.keyboard('4')
    expect(press(cell)).toBe(false)
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
    expect(announced).toEqual(['Cells changed: 3.'])
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

const BOOLEAN: Field = { valueType: 'BOOLEAN' }
const columnKeys = ROWS.map((_, i) => cellKey(`t1r${i}`, 'c0'))

/** The column's value popover, named by its header. */
const popover = (column: string) => page.getByRole('dialog', { name: column })

const openPopover = async (column: string) => {
    await page.getByRole('button', { name: `Column actions ${column}` }).click()
    await page
        .getByRole('menuitem', { name: 'Apply value to all column cells' })
        .click()
}

test('Yes from the column’s popover fills its empty cells; with Overwrite it replaces values', async () => {
    const { value, announced } = await mount(
        [makeTable({ columns: ['Done'], fields: [BOOLEAN], rows: ROWS })],
        { values: [[columnKeys[1], 'false']] }
    )
    await openPopover('Done')
    await expect
        .element(popover('Done').getByRole('combobox', { name: 'Done' }))
        .toHaveFocus()
    const apply = popover('Done').getByRole('button', { name: 'Apply' })
    await expect.element(apply).toBeDisabled()
    await userEvent.keyboard('y')
    await expect
        .element(
            popover('Done').getByText('Changes 2 cells. 1 already has a value.')
        )
        .toBeVisible()
    await apply.click()
    await expect.element(popover('Done')).not.toBeInTheDocument()
    expect(columnKeys.map(value)).toEqual(['true', 'false', 'true'])
    expect(announced).toEqual(['Cells changed: 2.'])
    await expect
        .element(page.getByRole('button', { name: 'Column actions Done' }))
        .toHaveFocus()

    await openPopover('Done')
    await userEvent.keyboard('y')
    await popover('Done')
        .getByRole('checkbox', { name: 'Overwrite existing values' })
        .click()
    // The cells that hold Yes already are not changed.
    await expect
        .element(popover('Done').getByText('Changes 1 cell.', { exact: true }))
        .toBeVisible()
    await popover('Done').getByRole('button', { name: 'Apply' }).click()
    expect(columnKeys.map(value)).toEqual(['true', 'true', 'true'])
    expect(announced.at(-1)).toBe('Cells changed: 1.')
})

test('the popover’s preview says what the summary then announces, after the provider is asked', async () => {
    const confirmBulk = vi.fn((_keys: ReadonlyArray<CellKey>) => ({
        title: 'Create events?',
        body: 'This creates 1 events on this page.',
        confirm: 'Create events',
    }))
    const { value, announced } = await mount(
        [makeTable({ columns: ['A'], rows: ROWS })],
        {
            values: [[columnKeys[0], '1']],
            effects: { [columnKeys[1]]: { readOnly: 'Completed' } },
            confirmBulk,
        }
    )
    await openPopover('A')
    const apply = popover('A').getByRole('button', { name: 'Apply' })
    // Text that is not a value keeps Apply disabled.
    await userEvent.keyboard('abc{Enter}')
    await expect.element(apply).toBeDisabled()
    expect(announced).toEqual(['Enter a whole number'])
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}5{Enter}')
    await expect
        .element(
            popover('A').getByText(
                'Changes 1 cell. 1 already has a value. 1 skipped: Completed.'
            )
        )
        .toBeVisible()
    await apply.click()
    expect(confirmBulk).toHaveBeenLastCalledWith([columnKeys[2]])
    await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Create events' })
        .click()
    expect(columnKeys.map(value)).toEqual(['1', undefined, '5'])
    expect(announced).toEqual([
        'Enter a whole number',
        'Cells changed: 1. 1 skipped: Completed.',
    ])
})

const Seven: CellComponent = ({ id, labelledBy }) => {
    const { view } = useCellContext()
    return (
        <button
            type="button"
            id={id}
            aria-labelledby={labelledBy}
            onClick={() => view.commit('7')}
        >
            Seven
        </button>
    )
}

test('a column whose field a host replaces takes its value from the replacement in the popover', async () => {
    const { value } = await mount([makeTable({ columns: ['A'], rows: ROWS })], {
        overrides: { fields: { c0: Seven } },
    })
    await openPopover('A')
    await popover('A').getByText('Seven').click()
    await popover('A').getByRole('button', { name: 'Apply' }).click()
    expect(columnKeys.map(value)).toEqual(['7', '7', '7'])
})

test('from a cell’s context menu the popover sits under the column’s header, adds no live region, and neither Escape while typing nor Cancel writes anything', async () => {
    const { value, announced } = await mount([
        makeTable({ columns: ['A'], rows: ROWS }),
    ])
    const cell = control(columnKeys[1])
    cell.focus()
    contextMenu(cell)
    await page
        .getByRole('menuitem', { name: 'Apply value to all column cells' })
        .click()
    await expect.element(popover('A')).toBeVisible()
    const header = document
        .getElementById(headerDomId(ID_SCOPE, 't1', 'c0'))
        ?.closest('th')
    expect(
        popover('A').element().getBoundingClientRect().top -
            (header?.getBoundingClientRect().bottom ?? Number.NaN)
    ).toBeCloseTo(0, 0)
    expect(page.getByRole('status').elements()).toHaveLength(1)
    // Escape while typing puts the cell back and keeps the popover.
    await userEvent.keyboard('5{Escape}')
    await expect
        .element(popover('A').getByRole('textbox', { name: 'A' }))
        .toHaveValue('')
    await expect.element(popover('A')).toBeVisible()
    await userEvent.keyboard('5{Enter}')
    await popover('A').getByRole('button', { name: 'Cancel' }).click()
    await expect.element(popover('A')).not.toBeInTheDocument()
    expect(columnKeys.map(value)).toEqual([undefined, undefined, undefined])
    expect(announced).toEqual([])
    await expect.element(cell).toHaveFocus()
})

test('a press elsewhere closes the popover and leaves focus where the press put it', async () => {
    await mount([
        makeTable({ columns: ['A', 'B', 'C', 'D', 'E', 'F'], rows: ROWS }),
    ])
    const button = page.getByRole('button', { name: 'Column actions A' })
    await openPopover('A')
    await expect.element(popover('A')).toBeVisible()
    // On text that takes no focus: focus does not go back to the button.
    await userEvent.click(page.getByText('Table t1'))
    await expect.element(popover('A')).not.toBeInTheDocument()
    // Past the frames in which a closing popover moves focus.
    await nextFrame()
    await nextFrame()
    await expect.element(button).not.toHaveFocus()

    // On another cell, past the popover's width: that cell keeps focus.
    await openPopover('A')
    await expect.element(popover('A')).toBeVisible()
    const other = control(cellKey('t1r0', 'c5'))
    await userEvent.click(other)
    await expect.element(popover('A')).not.toBeInTheDocument()
    await nextFrame()
    await nextFrame()
    expect(focused()).toBe(other.id)
})

test('a file column can be cleared but takes no value to apply', async () => {
    await mount([
        makeTable({
            columns: ['A'],
            fields: [{ valueType: 'FILE_RESOURCE' }],
            rows: ROWS,
        }),
    ])
    await page.getByRole('button', { name: 'Column actions A' }).click()
    await expect.poll(items).toEqual(['Clear all column cells'])
})

test('an option picked from the list in the popover is applied to the column', async () => {
    const { value } = await mount([
        makeTable({
            columns: ['A'],
            fields: [
                {
                    valueType: 'TEXT',
                    options: [
                        { code: 'A', name: 'Alpha' },
                        { code: 'B', name: 'Beta' },
                    ],
                },
            ],
            rows: ROWS,
        }),
    ])
    await openPopover('A')
    await popover('A').getByRole('combobox', { name: 'A' }).click()
    await popover('A').getByRole('option', { name: 'Beta' }).click()
    await expect.element(popover('A')).toBeVisible()
    await popover('A').getByRole('button', { name: 'Apply' }).click()
    expect(columnKeys.map(value)).toEqual(['B', 'B', 'B'])
})

test('a value typed into the popover is applied with one click on Apply', async () => {
    const { value, announced } = await mount([
        makeTable({ columns: ['A'], rows: ROWS }),
    ])
    await openPopover('A')
    await userEvent.keyboard('5')
    await popover('A').getByRole('button', { name: 'Apply' }).click()
    await expect.element(popover('A')).not.toBeInTheDocument()
    expect(columnKeys.map(value)).toEqual(['5', '5', '5'])
    expect(announced).toEqual(['Cells changed: 3.'])
})
