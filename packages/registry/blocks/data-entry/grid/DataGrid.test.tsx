/// <reference types="@vitest/browser-playwright" />
import { cdp, page, userEvent } from 'vitest/browser'
import { withEditor } from '../cells/__tests__/harness'
import { cells } from '../cells/Cell'
import { cellDomId } from '../cells/cellProps'
import type { CellComponent } from '../cells/cellProps'
import type { CellMessage } from '../logic/effects'
import { cellKey } from '../model/types'
import type { CellKey } from '../model/types'
import {
    control,
    focused,
    ID_SCOPE,
    INTEGER,
    makeTable,
    mount,
    nextFrame,
    paste,
    range,
    stylesFor,
    visibleBox,
} from './__tests__/gridRig'

test('every editable cell is named by its row and column headers', async () => {
    await mount([
        makeTable(),
        makeTable({
            id: 't2',
            columns: ['Weight', 'Height'],
            rows: ['2026-10-22'],
            groups: [{ id: 'g', label: 'Child', span: 2 }],
        }),
    ])
    await expect
        .element(page.getByRole('textbox', { name: 'Age (years) 2026-10-20' }))
        .toBeVisible()
    // Header ids repeat across tables; each cell is named by its own table's headers.
    await expect
        .element(page.getByRole('textbox', { name: 'Child Weight 2026-10-22' }))
        .toBeVisible()
    await expect
        .element(page.getByRole('textbox', { name: 'Child Height 2026-10-22' }))
        .toBeVisible()
})

test('a group label wider than the screen stays in view', async () => {
    await mount([
        makeTable({
            columns: range(12, (i) => `Column ${i}`),
            groups: [{ id: 'g', label: 'Child', span: 12 }],
        }),
    ])
    const label = page.getByText('Child', { exact: true }).element()
    expect(getComputedStyle(label).position).toBe('sticky')
    const region = page.getByRole('region').element()
    region.scrollLeft = 600
    await nextFrame()
    const rowHeader = page.getByRole('rowheader').element()
    const box = label.getBoundingClientRect()
    expect(box.left).toBeGreaterThanOrEqual(
        rowHeader.getBoundingClientRect().right - 1
    )
    expect(box.right).toBeLessThanOrEqual(region.getBoundingClientRect().right)
})

test('the focused cell is not hidden under the sticky header', async () => {
    await mount([
        makeTable({
            rows: range(40, (i) => `Row ${i}`),
            groups: [{ id: 'g', label: 'Child', span: 1 }],
        }),
    ])
    const region = page.getByRole('region').element()
    const head = region.querySelector('thead')
    if (head === null) {
        throw new Error('No header')
    }
    const height = head.getBoundingClientRect().height
    await expect
        .poll(() => parseFloat(getComputedStyle(region).scrollPaddingTop))
        .toBeCloseTo(height, 0)
    // Row 10 half under the header, then focused.
    const target = control(cellKey('t1r10', 'c0'))
    region.scrollTop +=
        target.getBoundingClientRect().top -
        region.getBoundingClientRect().top -
        height / 2
    await nextFrame()
    target.focus()
    await nextFrame()
    expect(target.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        head.getBoundingClientRect().bottom - 1
    )
})

test('Enter at the last row of the first table continues into the second', async () => {
    await mount(
        [
            makeTable({
                rows: ['a', 'b', 'c'],
                closed: [cellKey('t1r1', 'c0')],
            }),
            makeTable({ id: 't2', rows: ['d'] }),
        ],
        // Read-only cells take focus; only closed ones are skipped.
        { effects: { [cellKey('t1r2', 'c0')]: { readOnly: 'Completed' } } }
    )
    control(cellKey('t1r0', 'c0')).focus()
    await userEvent.keyboard('{Enter}')
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t1r2', 'c0')))
    await userEvent.keyboard('{Enter}')
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t2r0', 'c0')))
    await userEvent.keyboard('{ArrowUp}')
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t1r2', 'c0')))
    await userEvent.keyboard('{ArrowUp}')
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t1r0', 'c0')))
})

test('Enter after a run of Tabs returns to the column the run began in; an arrow or a click ends the run', async () => {
    const { value } = await mount([
        makeTable({ columns: ['A', 'B', 'C'], rows: ['a', 'b', 'c', 'd'] }),
    ])
    control(cellKey('t1r0', 'c0')).focus()
    // Typing a row of values, as Excel's Tab-then-Enter is for.
    await userEvent.keyboard('1{Tab}2{Tab}3{Enter}')
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t1r1', 'c0')))
    expect(['c0', 'c1', 'c2'].map((c) => value(cellKey('t1r0', c)))).toEqual([
        '1',
        '2',
        '3',
    ])
    await userEvent.keyboard('{Tab}{ArrowRight}{Enter}')
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t1r2', 'c2')))
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{Tab}')
    await userEvent.click(control(cellKey('t1r2', 'c2')))
    await userEvent.keyboard('{Enter}')
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t1r3', 'c2')))
})

test('pasting a 2×2 block fills four cells', async () => {
    const { store, value, announced } = await mount([
        makeTable({ columns: ['A', 'B', 'C'], rows: ['a', 'b', 'c'] }),
    ])
    const start = control(cellKey('t1r1', 'c1'))
    start.focus()
    expect(paste(start, '1\t2\r\n3\t4\r\n')).toBe(true)
    const block = [
        cellKey('t1r1', 'c1'),
        cellKey('t1r1', 'c2'),
        cellKey('t1r2', 'c1'),
        cellKey('t1r2', 'c2'),
    ]
    expect(block.map(value)).toEqual(['1', '2', '3', '4'])
    expect(announced).toEqual(['Cells pasted: 4'])
    // One undo step for the whole block.
    store.getState().undo()
    expect(block.map(value)).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
    ])
})

test('a pasted block skips closed, locked, hidden and editorless pop-up cells without shifting', async () => {
    withEditor('LONG_TEXT', undefined)
    const { value, announced } = await mount(
        [
            makeTable({
                columns: ['A', 'B', 'Notes'],
                fields: [INTEGER, INTEGER, { valueType: 'LONG_TEXT' }],
                rows: ['a', 'b', 'c'],
                closed: [cellKey('t1r2', 'c0')],
            }),
        ],
        {
            effects: {
                [cellKey('t1r0', 'c1')]: { readOnly: 'Assigned by rule' },
                [cellKey('t1r1', 'c0')]: { hiddenBy: 'Hidden by rule' },
            },
        }
    )
    const start = control(cellKey('t1r0', 'c0'))
    start.focus()
    paste(start, '1\t2\t3\n4\t5\t6\n7\t8\t9')
    expect(
        ['t1r0', 't1r1', 't1r2'].map((r) =>
            ['c0', 'c1', 'c2'].map((c) => value(cellKey(r, c)))
        )
    ).toEqual([
        ['1', undefined, undefined],
        [undefined, '5', undefined],
        [undefined, '8', undefined],
    ])
    expect(announced).toEqual(['Cells pasted: 3'])
})

test('a single value pasted in Ready is saved without its quotes; in Edit it is text', async () => {
    const key = cellKey('t1r0', 'c0')
    const { value } = await mount([makeTable()], { values: [[key, '5']] })
    const input = control(key)
    input.focus()
    expect(paste(input, '"12"')).toBe(true)
    expect(value(key)).toBe('12')
    // Still Ready: typing replaces the pasted value.
    await userEvent.keyboard('7{Enter}')
    expect(value(key)).toBe('7')
    input.focus()
    await userEvent.keyboard('{F2}')
    expect(paste(input, '3')).toBe(false)
    expect(value(key)).toBe('7')
})

test('a skip link moves focus past the grid', async () => {
    await mount([makeTable(), makeTable({ id: 't2' })])
    const skip = page.getByRole('link', { name: 'Skip past the grid' })
    skip.element().focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Tab}')
    await expect
        .element(page.getByRole('button', { name: 'After' }))
        .toHaveFocus()
    // The page's address is left alone, for apps that route by it.
    expect(location.hash).toBe('')
})

test('Ctrl+Z undoes the last change', async () => {
    const { value } = await mount([makeTable({ rows: ['a', 'b', 'c'] })])
    control(cellKey('t1r0', 'c0')).focus()
    await userEvent.keyboard('7{Enter}8{Enter}')
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(value(cellKey('t1r1', 'c0'))).toBeUndefined()
    expect(value(cellKey('t1r0', 'c0'))).toBe('7')
    // Focus goes to the cell that changed, so the undo is seen and heard.
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t1r1', 'c0')))
    // In Edit, Ctrl+Z belongs to the text.
    await userEvent.keyboard('{F2}{Control>}z{/Control}')
    expect(value(cellKey('t1r0', 'c0'))).toBe('7')
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t1r1', 'c0')))
})

test('one polite live region says the same text twice', async () => {
    const { announce } = await mount([makeTable(), makeTable({ id: 't2' })])
    expect(page.getByRole('status').elements()).toHaveLength(1)
    const region = page.getByRole('status').element()
    const said: string[] = []
    new MutationObserver(() => said.push(region.textContent ?? '')).observe(
        region,
        { childList: true, characterData: true, subtree: true }
    )
    announce('All changes saved')
    await expect.poll(() => said).toEqual(['All changes saved'])
    announce('All changes saved')
    await expect
        .poll(() => said)
        .toEqual(['All changes saved', '', 'All changes saved'])
})

test('two things said at once are both said, in order, 150 ms apart', async () => {
    const { announce } = await mount([makeTable()])
    const region = page.getByRole('status').element()
    const said: Array<[string, number]> = []
    new MutationObserver(() => {
        if (region.textContent) {
            said.push([region.textContent, performance.now()])
        }
    }).observe(region, { childList: true, characterData: true, subtree: true })
    announce('Cells pasted: 4')
    announce('Enter a whole number')
    await expect
        .poll(() => said.map(([text]) => text))
        .toEqual(['Cells pasted: 4', 'Enter a whole number'])
    expect(said[1][1] - said[0][1]).toBeGreaterThanOrEqual(140)
})

test('a newer text replaces one still waiting to be said', async () => {
    const { announce } = await mount([makeTable()])
    const region = page.getByRole('status').element()
    const said: string[] = []
    new MutationObserver(() => {
        if (region.textContent) {
            said.push(region.textContent)
        }
    }).observe(region, { childList: true, characterData: true, subtree: true })
    announce('Cells pasted: 4')
    announce('Values not saved: 1')
    announce('All changes saved')
    await expect
        .poll(() => said)
        .toEqual(['Cells pasted: 4', 'All changes saved'])
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(said).toEqual(['Cells pasted: 4', 'All changes saved'])
})

test('a value refused on Enter or on leaving the cell is announced', async () => {
    const { announced } = await mount([makeTable({ rows: ['a', 'b'] })])
    control(cellKey('t1r0', 'c0')).focus()
    await userEvent.keyboard('abc{Enter}')
    expect(announced).toEqual(['Enter a whole number'])
    control(cellKey('t1r1', 'c0')).focus()
    await userEvent.keyboard('x')
    await userEvent.click(page.getByRole('button', { name: 'After' }))
    expect(announced).toEqual(['Enter a whole number', 'Enter a whole number'])
})

test('row headers mark completed and scheduled events', async () => {
    const plain = makeTable({
        rows: [
            '2026-10-20',
            '2026-10-21',
            '2026-10-22',
            'Antenatalcarevisitfollowedbyalongnamewithnospaces',
        ],
    })
    const statuses = ['COMPLETED', 'SCHEDULE', 'OVERDUE', 'ACTIVE'] as const
    const marked = {
        ...plain,
        rows: plain.rows.map((row, i) => ({ ...row, status: statuses[i] })),
    }
    await mount([marked])
    await expect
        .element(page.getByRole('rowheader', { name: '2026-10-20 Completed' }))
        .toBeVisible()
    await expect
        .element(page.getByRole('rowheader', { name: '2026-10-21 Scheduled' }))
        .toBeVisible()
    await expect
        .element(page.getByRole('rowheader', { name: '2026-10-22 Scheduled' }))
        .toBeVisible()
    // The marker is the row's, not part of every cell's name.
    await expect
        .element(
            page.getByRole('textbox', {
                name: 'Age (years) 2026-10-20',
                exact: true,
            })
        )
        .toBeVisible()
    const label = page.getByText(
        'Antenatalcarevisitfollowedbyalongnamewithnospaces'
    )
    expect(label.element().getAttribute('dir')).toBe('auto')
    const header = page.getByRole('rowheader').nth(3).element()
    expect(getComputedStyle(header).overflowWrap).toBe('anywhere')
})

test('a right-to-left label reads right to left; its row header keeps the table’s direction and stays at its start', async () => {
    await mount([
        makeTable({
            columns: range(12, (i) => `Column ${i}`),
            rows: ['2026-10-20', 'زيارة رعاية ما قبل الولادة'],
        }),
    ])
    const label = page.getByText('زيارة رعاية ما قبل الولادة').element()
    expect(getComputedStyle(label).direction).toBe('rtl')
    const region = page.getByRole('region').element()
    region.scrollLeft = 600
    await nextFrame()
    const start = region.getBoundingClientRect().left + region.clientLeft
    for (const header of page.getByRole('rowheader').elements()) {
        expect(header.getBoundingClientRect().left).toBeCloseTo(start, 0)
        // Its edge between header and cells is on the cells' side.
        expect(getComputedStyle(header).direction).toBe('ltr')
        expect(getComputedStyle(header).borderRightWidth).toBe('1px')
        expect(getComputedStyle(header).borderLeftWidth).toBe('0px')
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

test('a cell’s notes show outside the scrolling table', async () => {
    const last = cellKey('t1r29', 'c0')
    await mount([makeTable({ rows: range(30, (i) => `Row ${i}`) })], {
        effects: {
            [last]: {
                messages: [
                    {
                        kind: 'error',
                        text: 'Too old for this stage',
                        source: 'rule',
                    },
                ],
            },
        },
    })
    control(last).focus()
    const note = page.getByText('Too old for this stage')
    await expect.element(note).toBeVisible()
    // A popover follows its scrolled cell from the next frame, before it is painted.
    await nextFrame()
    await nextFrame()
    const region = page.getByRole('region').element().getBoundingClientRect()
    const box = note.element().getBoundingClientRect()
    // Under its cell, which sits at the bottom of the scrolled region.
    expect(box.top).toBeGreaterThanOrEqual(
        control(last).getBoundingClientRect().bottom
    )
    expect(box.top).toBeLessThan(
        control(last).getBoundingClientRect().bottom + 8
    )
    expect(box.bottom).toBeGreaterThan(region.bottom)
    // The table's scrolling region does not cut off the part below it.
    expect((await visibleBox(note.element())).bottom).toBeCloseTo(box.bottom, 0)
})

test('without anchor positioning, popovers hang under their cell inside the table', async () => {
    const key = cellKey('t1r0', 'c0')
    await mount(
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
        {
            effects: {
                [key]: {
                    messages: [
                        { kind: 'warning', text: 'Check it', source: 'rule' },
                    ],
                },
            },
        }
    )
    control(key).focus()
    await userEvent.keyboard('{F4}')
    // The notes and the option list are each the parent of what they say.
    const [note, list] = [
        page.getByText('Check it'),
        page.getByRole('listbox'),
    ].map((locator) => {
        const popover = locator.element().parentElement
        if (popover === null) {
            throw new Error('No popover')
        }
        return stylesFor(popover)
    })
    for (const { always, anchored } of [note, list]) {
        expect(always).toContain('position: absolute')
        expect(always).toContain('top: 100%')
        expect(always).not.toMatch(/anchor|position-try|position: fixed/)
        expect(anchored).toContain('position: fixed')
        expect(anchored).toContain('top: anchor(bottom)')
    }
    expect(list.always).toContain('min-width: 100%')
})

test('the option list opens above its cell when there is no room below, over the sticky header', async () => {
    const options = range(6, (i) => `Option ${i}`).map((name, i) => ({
        code: `o${i}`,
        name,
    }))
    await mount(
        [
            makeTable({
                columns: ['Outcome'],
                fields: [{ valueType: 'TEXT', options }],
            }),
        ],
        { above: 'calc(100vh - 7rem)' }
    )
    const cell = control(cellKey('t1r0', 'c0'))
    cell.focus({ preventScroll: true })
    await userEvent.keyboard('{F4}')
    const list = page.getByRole('listbox').element()
    await expect.element(page.getByRole('listbox')).toBeVisible()
    const box = list.getBoundingClientRect()
    expect(box.bottom).toBeLessThanOrEqual(cell.getBoundingClientRect().top + 1)
    const head = document.querySelector('thead')?.getBoundingClientRect()
    if (head === undefined) {
        throw new Error('No header')
    }
    expect(box.top).toBeLessThan(head.top)
    const shown = document.elementFromPoint(
        box.left + 8,
        (head.top + head.bottom) / 2
    )
    expect(list.contains(shown)).toBe(true)
})

test('typing renders one cell, not the others or the table; 2,500 cells drawn', async () => {
    const reads = { effects: 0, tables: 0 }
    const started = performance.now()
    // A clinic desktop, as the performance budgets measure.
    await cdp().send('Emulation.setCPUThrottlingRate', { rate: 4 })
    try {
        await mount(
            [
                makeTable({
                    columns: range(50, (i) => `Column ${i}`),
                    rows: range(50, (i) => `Row ${i}`),
                }),
            ],
            {
                onRead: (what) => {
                    reads[what]++
                },
            }
        )
        await nextFrame()
        const painted = (await nextFrame()) - started
        console.info(
            `2,500 cells painted in ${Math.round(painted)} ms (CPU 4×, dev build)`
        )
    } finally {
        await cdp().send('Emulation.setCPUThrottlingRate', { rate: 1 })
    }
    expect(page.getByRole('textbox').elements()).toHaveLength(2_500)
    control(cellKey('t1r20', 'c20')).focus()
    reads.effects = 0
    reads.tables = 0
    await userEvent.keyboard('12{Enter}')
    expect(reads.tables).toBe(0)
    // A handful of reads for the typed and the newly focused cell, against one per cell for a grid redrawn.
    expect(reads.effects).toBeLessThan(25)
})

test('a 2,500-cell grid mounts notes only for cells that have them, subscribes by row, and typing renders one cell', async () => {
    const noted = cellKey('t1r0', 'c0')
    const typed = cellKey('t1r20', 'c20')
    const check: CellMessage = { kind: 'warning', text: 'Low', source: 'rule' }
    const rendered: CellKey[] = []
    // The default control, counting its renders by cell.
    const Counted: CellComponent = (props) => {
        rendered.push(props.cellKey)
        return <cells.number {...props} />
    }
    let subscriptions = 0
    const { effects } = await mount(
        [
            makeTable({
                columns: range(50, (i) => `Column ${i}`),
                rows: range(50, (i) => `Row ${i}`),
            }),
        ],
        {
            effects: { [noted]: { messages: [check] } },
            overrides: { valueTypes: { INTEGER: Counted } },
            onSubscribe: () => (subscriptions += 1),
        }
    )
    const controls = page.getByRole('textbox').elements()
    expect(controls).toHaveLength(2_500)
    // The rows subscribe to the stores and hand each cell its state.
    expect(subscriptions).toBeLessThan(2_500)
    // A cell without notes holds its control alone, described by nothing.
    const notesOf = (key: CellKey) =>
        control(key)
            .getAttribute('aria-describedby')
            ?.split(' ')
            .map((id) => document.getElementById(id)?.textContent)
    expect(
        controls.filter(
            (element) =>
                element.parentElement?.childElementCount !== 1 ||
                element.hasAttribute('aria-describedby')
        )
    ).toEqual([control(noted)])
    expect(notesOf(noted)).toEqual(['Low'])
    // A cell that gains a note gets its description node and the attribute naming it.
    const later = cellKey('t1r1', 'c1')
    effects.setState(({ cells: all }) => ({
        cells: {
            ...all,
            [later]: {
                required: false,
                messages: [{ kind: 'error', text: 'Too high', source: 'rule' }],
            },
        },
    }))
    await expect.poll(() => notesOf(later)).toEqual(['Too high'])
    control(typed).focus()
    rendered.length = 0
    await userEvent.keyboard('12{Enter}')
    expect(focused()).toBe(cellDomId(ID_SCOPE, cellKey('t1r21', 'c20')))
    expect(new Set(rendered)).toEqual(new Set([typed]))
})
