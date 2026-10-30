/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { cellDomId } from '../cells/cellProps'
import { cellKey } from '../model/types'
import {
    control,
    focused,
    ID_SCOPE,
    makeTable,
    mount,
} from './__tests__/gridRig'

test('a row’s own errors and warnings show in its header, marked as a cell’s are', async () => {
    await mount([makeTable({ rows: ['2026-10-20', '2026-10-21'] })], {
        rowMessages: [
            [
                't1r0',
                [
                    { kind: 'error', text: 'Rules failed: x', source: 'rule' },
                    {
                        kind: 'warningOnComplete',
                        text: 'Check the date',
                        source: 'rule',
                    },
                ],
            ],
        ],
    })
    const header = page.getByRole('rowheader').first()
    await expect.element(header).toHaveTextContent('Rules failed: x')
    await expect.element(header).toHaveTextContent('Check the date')
    const [error, warning] = header.getByRole('listitem').elements()
    expect([error.textContent, warning.textContent]).toEqual([
        'Rules failed: x',
        'Check the date',
    ])
    for (const message of [error, warning]) {
        expect(getComputedStyle(message).borderInlineStartWidth).toBe('2px')
    }
    expect(getComputedStyle(error).borderInlineStartColor).not.toBe(
        getComputedStyle(warning).borderInlineStartColor
    )
    // The other row says nothing.
    await expect
        .element(page.getByRole('rowheader').nth(1))
        .toHaveTextContent(/^2026-10-21$/)
})

test('row headers take at most 30% of a narrow screen, so the page reflows at 400% zoom', async () => {
    const { innerWidth, innerHeight } = window
    await page.viewport(320, 640)
    try {
        await mount([makeTable()])
        const width = page
            .getByRole('rowheader')
            .element()
            .getBoundingClientRect().width
        expect(width).toBeLessThanOrEqual(320 * 0.3 + 1)
    } finally {
        await page.viewport(innerWidth, innerHeight)
    }
})

test('"Add event" adds a row and focuses its first open cell; each button names its table', async () => {
    const { added } = await mount(
        [
            makeTable({ columns: ['Stage only', 'Age (years)'] }),
            makeTable({ id: 't2', columns: ['Stage only', 'Age (years)'] }),
            makeTable({ id: 't3', rows: ['2026-11-01'] }),
        ],
        { newRowTables: ['t1', 't2'], closedOnNewRows: ['c0'] }
    )
    const buttons = page.getByRole('button', { name: 'Add event' })
    expect(buttons.elements()).toHaveLength(2)
    await expect.element(buttons.nth(0)).toHaveAccessibleDescription('Table t1')
    await expect.element(buttons.nth(1)).toHaveAccessibleDescription('Table t2')
    await buttons.nth(1).click()
    expect(added).toEqual(['t2'])
    await expect.poll(focused).toBe(cellDomId(ID_SCOPE, cellKey('t2r1', 'c1')))
})

test.each(['Control', 'Meta'])(
    '%s+Enter in any cell adds a row to its table and focuses the row’s first open cell',
    async (modifier) => {
        const { added } = await mount(
            [
                makeTable({ columns: ['Stage only', 'Age (years)'] }),
                makeTable({ id: 't2', columns: ['Stage only', 'Age (years)'] }),
                makeTable({ id: 't3', rows: ['2026-11-01'] }),
            ],
            { newRowTables: ['t1', 't2'], closedOnNewRows: ['c0'] }
        )
        await expect
            .element(page.getByRole('button', { name: 'Add event' }).first())
            .toHaveAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter')
        const shortcut = `{${modifier}>}{Enter}{/${modifier}}`
        // A table that takes no new rows leaves the keys alone.
        control(cellKey('t3r0', 'c0')).focus()
        await userEvent.keyboard(shortcut)
        expect(added).toEqual([])
        control(cellKey('t2r0', 'c0')).focus()
        await userEvent.keyboard(shortcut)
        expect(added).toEqual(['t2'])
        await expect
            .poll(focused)
            .toBe(cellDomId(ID_SCOPE, cellKey('t2r1', 'c1')))
    }
)

test('Ctrl+Enter while typing saves the text, then adds the row; text that is not a value stays to be fixed', async () => {
    const { added, value } = await mount(
        [makeTable({ columns: ['Weight', 'Age (years)'] })],
        { newRowTables: ['t1'] }
    )
    const age = control(cellKey('t1r0', 'c1'))
    age.focus()
    await userEvent.keyboard('abc{Control>}{Enter}{/Control}')
    expect(added).toEqual([])
    expect(focused()).toBe(age.id)
    await userEvent.keyboard('{Backspace>3/}7{Control>}{Enter}{/Control}')
    expect(value(cellKey('t1r0', 'c1'))).toBe('7')
    expect(added).toEqual(['t1'])
    await expect.poll(focused).toBe(cellDomId(ID_SCOPE, cellKey('t1r1', 'c0')))
})

test('Ctrl+Enter in an option list picks the highlighted option, then adds the row', async () => {
    const { added, value } = await mount(
        [
            makeTable({
                columns: ['Outcome'],
                fields: [
                    {
                        valueType: 'TEXT',
                        options: [{ code: 'a', name: 'Alive' }],
                    },
                ],
            }),
        ],
        { newRowTables: ['t1'] }
    )
    control(cellKey('t1r0', 'c0')).focus()
    await userEvent.keyboard('Ali{Control>}{Enter}{/Control}')
    expect(value(cellKey('t1r0', 'c0'))).toBe('a')
    expect(added).toEqual(['t1'])
    await expect.poll(focused).toBe(cellDomId(ID_SCOPE, cellKey('t1r1', 'c0')))
})

test('Ctrl+Enter in a pop-up editor saves it without adding a row', async () => {
    const { added, value } = await mount(
        [
            makeTable({
                columns: ['Note'],
                fields: [{ valueType: 'LONG_TEXT' }],
            }),
        ],
        { newRowTables: ['t1'] }
    )
    const note = control(cellKey('t1r0', 'c0'))
    note.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(focused).not.toBe(note.id)
    await userEvent.keyboard('Seen{Control>}{Enter}{/Control}')
    await expect.poll(() => value(cellKey('t1r0', 'c0'))).toBe('Seen')
    expect(added).toEqual([])
})
