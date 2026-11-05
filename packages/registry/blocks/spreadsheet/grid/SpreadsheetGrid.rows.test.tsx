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
                    { tone: 'error', text: 'Rules failed: x' },
                    { tone: 'warning', text: 'Check the date' },
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

test('a row’s notes are a marker with their count that opens them, and the row stays one line', async () => {
    const feedback = `## Feedback\n\n- Weight is low\n- ${'Check again next visit. '.repeat(20)}`
    await mount([makeTable({ rows: ['a', 'b', 'c'] })], {
        rowNotes: [
            ['t1r0', [feedback, 'Second note']],
            ['t1r1', ['Only note']],
        ],
    })
    const [noted, , plain] = page.getByRole('rowheader').elements()
    expect(noted.getBoundingClientRect().height).toBe(
        plain.getBoundingClientRect().height
    )
    // The header is named without the notes; screen readers hear them as its description.
    await expect.element(noted).not.toHaveAccessibleName(/Weight/)
    await expect
        .element(noted)
        .toHaveAccessibleDescription(/Weight is low.*Second note/)
    await expect
        .element(page.getByRole('button', { name: 'Note', exact: true }))
        .toHaveAttribute('tabindex', '-1')
    const marker = page.getByRole('button', { name: 'Notes: 2' })
    await expect.element(marker).toHaveAttribute('tabindex', '-1')
    await marker.click()
    const notes = page.getByRole('dialog', { name: 'Notes: 2 a' })
    const first = notes.getByRole('listitem').first()
    await expect.element(first).toHaveTextContent('Weight is low')
    expect(getComputedStyle(first.element()).whiteSpace).toBe('pre-wrap')
    await expect
        .element(notes.getByRole('listitem').nth(1))
        .toHaveTextContent('Second note')
    await userEvent.keyboard('{Escape}')
    await expect.element(notes).not.toBeInTheDocument()
    expect(document.activeElement).toBe(marker.element())
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

test('a heading that spans rows renders with rowSpan and names its cells', async () => {
    await mount([
        makeTable({
            columns: ['Name', 'Initiated', 'Completed'],
            headerRows: [
                [
                    { id: 'name', label: 'Name', span: 1, rowSpan: 2 },
                    { id: 'ifa', label: 'IFA', span: 2 },
                ],
                [
                    { id: 'init', label: 'Initiated', span: 1 },
                    { id: 'done', label: 'Completed', span: 1 },
                ],
            ],
        }),
    ])
    const name = page.getByRole('columnheader', { name: 'Name' })
    await expect.element(name).toHaveAttribute('rowspan', '2')
    await expect
        .element(page.getByRole('textbox', { name: 'Name 2026-10-20' }))
        .toBeVisible()
    await expect
        .element(
            page.getByRole('textbox', { name: 'IFA Initiated 2026-10-20' })
        )
        .toBeVisible()
})

test('a row message on complete has the error border', async () => {
    // The consumer's own message, with fields of its own: the grid reads its tone.
    const message = {
        tone: 'error',
        onComplete: true,
        source: 'rule',
        text: 'x',
    } as const
    await mount([makeTable({ rows: ['2026-10-20'] })], {
        rowMessages: [['t1r0', [message]]],
    })
    expect(page.getByRole('listitem').element().className).toContain(
        'border-dhis2-red-600'
    )
})

test('a table’s add button says what its addRow says', async () => {
    const add = vi.fn()
    await mount([makeTable({ id: 't' }), makeTable({ id: 'u' })], {
        addRow: new Map([['t', { label: 'Add visit', add }]]),
    })
    const button = page.getByRole('button', { name: 'Add visit' })
    await expect.element(button).toHaveAccessibleDescription('Table t')
    await button.click()
    expect(add).toHaveBeenCalledOnce()
    // The table with no entry has no add button.
    expect(document.querySelectorAll('button[aria-keyshortcuts]')).toHaveLength(
        1
    )
})

test('RowBadge and GridFooter render where they are slotted', async () => {
    await mount(
        [
            makeTable({ rows: ['2026-10-20', '2026-10-21'] }),
            makeTable({ id: 't2', rows: ['2026-11-01'] }),
        ],
        {
            RowBadge: ({ rowId }) => <span>{`badge:${rowId}`}</span>,
            GridFooter: ({ skipTargetId }) => <p>{`footer:${skipTargetId}`}</p>,
        }
    )
    const headers = page.getByRole('rowheader')
    await expect.element(headers.nth(0)).toHaveTextContent('badge:t1r0')
    await expect.element(headers.nth(1)).toHaveTextContent('badge:t1r1')
    await expect.element(headers.nth(2)).toHaveTextContent('badge:t2r0')
    // The badge is the row's, not part of its cells' names.
    await expect
        .element(
            page.getByRole('textbox', {
                name: 'Age (years) 2026-10-20',
                exact: true,
            })
        )
        .toBeVisible()
    // Once, after both tables and the place the skip link leads to, which it is handed.
    const footers = page.getByText(/^footer:/)
    expect(footers.elements()).toHaveLength(1)
    const target =
        page
            .getByRole('link', { name: 'Skip past the grid' })
            .element()
            .getAttribute('href')
            ?.slice(1) ?? ''
    expect(footers.element().textContent).toBe(`footer:${target}`)
    for (const before of [
        page.getByRole('region').nth(1).element(),
        document.getElementById(target),
    ]) {
        expect(
            (before?.compareDocumentPosition(footers.element()) ?? 0) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    }
})
