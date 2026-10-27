/// <reference types="@vitest/browser-playwright" />
import { createPortal } from 'react-dom'
import { onTestFinished } from 'vitest'
import { cdp, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import {
    control,
    makeTable,
    mount as mountGrid,
    nextFrame,
    visibleBox,
} from '../grid/__tests__/gridRig'
import { cellKey } from '../model/types'
import { CELL, HEADER, inputOf, rig, withEditor } from './__tests__/harness'
import { Cell } from './Cell'
import type { PopupEditorProps } from './popupEditors'

const LONG_TEXT: Field = { valueType: 'LONG_TEXT' }
const LOCKED = 'Assigned by rule: Copy the notes'
const HIDDEN = 'Hidden by rule: Hide the notes'
const PROBLEM = 'Notes cannot start with !'

/** An editor with a field it reports as typed (a draft starting with "!" cannot be saved) and Save, Clear and Cancel
 * buttons; Save saves two lines. */
const Stub = ({ value, firstKey, save, report, cancel }: PopupEditorProps) => (
    <>
        <input
            aria-label="Draft"
            defaultValue={firstKey ?? value}
            onChange={({ target: { value: text } }) =>
                report(text, text.startsWith('!') ? PROBLEM : undefined)
            }
        />
        <button type="button" onClick={() => save('two\nlines')}>
            Save
        </button>
        <button type="button" onClick={() => save(null)}>
            Clear
        </button>
        <button type="button" onClick={cancel}>
            Cancel
        </button>
    </>
)

const mount = async (field: Field, options?: Parameters<typeof rig>[1]) => {
    const setup = rig(field, options)
    await render(
        setup.ui(
            <Cell
                cellKey={CELL}
                field={field}
                labelledBy={HEADER}
                move={setup.move}
            />
        )
    )
    return {
        ...setup,
        cell: page.getByRole('textbox', { name: 'Age (years)' }),
    }
}

const dialog = page.getByRole('dialog', { name: 'Edit Age (years)' })
const draft = page.getByRole('textbox', { name: 'Draft' })

test('Enter, F2, double-click and Alt+↓ open the editor; Escape closes it and returns focus', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell, moves } = await mount(LONG_TEXT, { value: 'Some notes' })
    await expect.element(cell).toHaveValue('Some notes')
    await expect.element(cell).not.toHaveAttribute('readonly')
    await expect.element(cell).toHaveAttribute('aria-haspopup', 'dialog')
    inputOf(cell).focus()
    for (const open of [
        () => userEvent.keyboard('{Enter}'),
        () => userEvent.keyboard('{F2}'),
        () => userEvent.dblClick(cell),
        () => userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}'),
        () => userEvent.keyboard('{F4}'),
    ]) {
        await open()
        await expect.element(dialog).toBeVisible()
        // Focus moves to the editor's first field.
        await expect.element(draft).toHaveValue('Some notes')
        await expect.element(draft).toHaveFocus()
        await userEvent.keyboard('{Escape}')
        await expect.element(dialog).not.toBeInTheDocument()
        await expect.element(cell).toHaveFocus()
    }
    expect(moves).toEqual([])
})

test('Tab and Shift+Tab stay inside the editor; Cancel closes it', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell, enqueued } = await mount(LONG_TEXT)
    inputOf(cell).focus()
    await userEvent.keyboard('{F2}')
    await expect.element(draft).toHaveFocus()
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    await expect
        .element(page.getByRole('button', { name: 'Cancel' }))
        .toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect.element(draft).toHaveFocus()
    // Cancel drops what the editor reported.
    await userEvent.fill(draft, 'Dropped')
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }))
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
    expect(enqueued).toEqual([])
})

test('a press outside the editor saves what it last reported, or says why it cannot', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell, stored, enqueued, announced } = await mount(LONG_TEXT, {
        value: 'Some notes',
    })
    const outside = page.getByText('Age (years)')
    inputOf(cell).focus()
    // Nothing reported, nothing saved.
    await userEvent.keyboard('{Enter}')
    await userEvent.click(outside)
    await expect.element(dialog).not.toBeInTheDocument()
    expect(enqueued).toEqual([])

    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.fill(draft, 'Seen at home')
    await userEvent.click(outside)
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('Seen at home')
    // Focus stays where the press put it.
    await expect.element(cell).not.toHaveFocus()

    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.fill(draft, '!Seen')
    await userEvent.click(outside)
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('Seen at home')
    expect(announced).toEqual([PROBLEM])
})

test('focus sent out of the editor saves its report; Escape drops it', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell, stored } = await mount(LONG_TEXT, { value: 'Some notes' })
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    onTestFinished(() => elsewhere.remove())
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.fill(draft, 'Moved by a script')
    elsewhere.focus()
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('Moved by a script')
    expect(document.activeElement).toBe(elsewhere)

    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.fill(draft, 'Dropped')
    await userEvent.keyboard('{Escape}')
    await expect.element(cell).toHaveFocus()
    expect(stored()?.value).toBe('Moved by a script')
})

test('parts of an editor rendered in a portal are inside it', async () => {
    withEditor('LONG_TEXT', ({ save }: PopupEditorProps) => (
        <>
            <input aria-label="Draft" />
            {createPortal(
                // Clear of the dialog, as a popover would be.
                <button
                    type="button"
                    className="fixed end-0 bottom-0"
                    onClick={() => save('From a portal')}
                >
                    In a portal
                </button>,
                document.body
            )}
        </>
    ))
    const { cell, stored } = await mount(LONG_TEXT)
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    const button = page.getByRole('button', { name: 'In a portal' })
    button.element().focus()
    await expect.element(dialog).toBeVisible()
    await userEvent.click(button)
    expect(stored()?.value).toBe('From a portal')
})

test('a save that comes after its editor closed still saves, and leaves a newer editor open', async () => {
    let upload: PopupEditorProps['save'] | undefined
    withEditor('LONG_TEXT', ({ save }: PopupEditorProps) => (
        <button
            type="button"
            onClick={() => {
                upload = save
            }}
        >
            Upload
        </button>
    ))
    const { cell, stored } = await mount(LONG_TEXT)
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.click(page.getByRole('button', { name: 'Upload' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Enter}')
    await expect.element(dialog).toBeVisible()
    upload?.('scan-id')
    await expect.poll(() => stored()?.value).toBe('scan-id')
    await expect.element(dialog).toBeVisible()
})

test('a click on the selected cell opens its editor; the first click selects it', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell } = await mount(LONG_TEXT, { value: 'Some notes' })
    await userEvent.click(cell)
    await expect.element(cell).toHaveFocus()
    await expect.element(dialog).not.toBeInTheDocument()
    await userEvent.click(cell)
    await expect.element(dialog).toBeVisible()
})

test('the cell’s notes hide while its editor is open', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell } = await mount(LONG_TEXT, {
        effects: {
            messages: [
                { kind: 'warning', text: 'Check the notes', source: 'rule' },
            ],
        },
    })
    const note = page.getByText('Check the notes')
    inputOf(cell).focus()
    await expect.element(note).toBeVisible()
    await userEvent.keyboard('{Enter}')
    await expect.element(dialog).toBeVisible()
    await expect.element(note).not.toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(note).toBeVisible()
})

test('saving commits the stored value through the cell and returns to Ready', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell, moves, stored } = await mount(LONG_TEXT, {
        value: 'Some notes',
    })
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.click(page.getByRole('button', { name: 'Save' }))
    expect(stored()).toMatchObject({ value: 'two\nlines', sync: 'queued' })
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
    await expect.element(cell).toHaveAttribute('data-mode', 'ready')
    // An input shows one line: the line break reads as a space.
    await expect.element(cell).toHaveValue('two lines')
    // The next Enter moves on, as after typing in any cell.
    await userEvent.keyboard('{Enter}')
    expect(moves).toEqual(['enter'])
    await expect.element(dialog).not.toBeInTheDocument()
    // No value clears the cell.
    await userEvent.keyboard('{Enter}')
    await userEvent.click(page.getByRole('button', { name: 'Clear' }))
    expect(stored()?.value).toBeUndefined()
    await expect.element(cell).toHaveValue('')
})

test('typing a key opens editors that take a first key, with that key', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell } = await mount(LONG_TEXT, { value: 'Some notes' })
    inputOf(cell).focus()
    await userEvent.keyboard('a')
    await expect.element(dialog).toBeVisible()
    await expect.element(draft).toHaveValue('a')
    // The cell's own text is not typed into.
    await userEvent.keyboard('{Escape}')
    await expect.element(cell).toHaveValue('Some notes')
})

test('text from a dead key, AltGr or an input method opens the editor with that text', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell } = await mount(LONG_TEXT, { value: 'Some notes' })
    inputOf(cell).focus()
    // Text that arrives without a key of its own.
    await cdp().send('Input.insertText', { text: 'é' })
    await expect.element(draft).toHaveValue('é')
    await userEvent.keyboard('{Escape}')
    await expect.element(cell).toHaveValue('Some notes')
    // Several characters, composed before they are committed.
    await cdp().send('Input.imeSetComposition', {
        text: 'にほ',
        selectionStart: 2,
        selectionEnd: 2,
    })
    await cdp().send('Input.insertText', { text: '日本' })
    await expect.element(draft).toHaveValue('日本')
    await userEvent.keyboard('{Escape}')
    await expect.element(cell).toHaveValue('Some notes')
})

test('typing does not open an editor that starts from no key', async () => {
    withEditor('AGE', Stub)
    const { cell } = await mount({ valueType: 'AGE' }, { value: '2020-02-29' })
    // An age shows its date of birth as dates are typed: in the system date format.
    await expect.element(cell).toHaveValue('2020-02-29')
    inputOf(cell).focus()
    await userEvent.keyboard('a')
    await expect.element(dialog).not.toBeInTheDocument()
    expect(inputOf(cell).value).not.toContain('a')
})

test('a locked or hidden cell does not open its editor and says why', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell, effects, moves } = await mount(LONG_TEXT, {
        value: 'Some notes',
        effects: { readOnly: LOCKED },
    })
    await expect.element(cell).toHaveAttribute('readonly')
    await expect.element(cell).not.toHaveAttribute('aria-haspopup')
    await expect.element(cell).toHaveAccessibleDescription(LOCKED)
    inputOf(cell).focus()
    await userEvent.keyboard('{F2}a{F4}')
    await userEvent.dblClick(cell)
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveValue('Some notes')
    // Enter moves on, as in any read-only cell.
    await userEvent.keyboard('{Enter}')
    expect(moves).toEqual(['enter'])

    effects.setState({
        cells: {
            [CELL]: { required: false, messages: [], hiddenBy: HIDDEN },
        },
    })
    await expect.element(cell).toHaveValue('Hidden')
    await expect.element(cell).toHaveAccessibleDescription(HIDDEN)
    await userEvent.keyboard('{F2}')
    await expect.element(dialog).not.toBeInTheDocument()
})

test('a rule locking the cell closes its editor without saving', async () => {
    withEditor('LONG_TEXT', Stub)
    const { cell, effects, stored, enqueued, announced } = await mount(
        LONG_TEXT,
        { value: 'Some notes' }
    )
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.fill(draft, 'Changed')
    effects.setState({
        cells: {
            [CELL]: { required: false, messages: [], readOnly: LOCKED },
        },
    })
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
    expect(stored()?.value).toBe('Some notes')
    expect(enqueued).toEqual([])
    expect(announced).toEqual([LOCKED])

    // Text in a cell a rule only hides would be saved: the editor's report is dropped instead.
    effects.setState({ cells: {} })
    await userEvent.keyboard('{Enter}')
    await userEvent.fill(draft, 'Changed')
    effects.setState({
        cells: {
            [CELL]: { required: false, messages: [], hiddenBy: HIDDEN },
        },
    })
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
    expect(enqueued).toEqual([])
    expect(announced).toEqual([LOCKED, HIDDEN])
})

test('a value type with no editor stays read-only with "Edit this field in its own form"', async () => {
    withEditor('COORDINATE', undefined)
    const { cell, moves } = await mount(
        { valueType: 'COORDINATE' },
        { value: '[-11.4,8.2]' }
    )
    // Shown as DHIS2 displays it: latitude first.
    await expect.element(cell).toHaveValue('8.2, -11.4')
    await expect.element(cell).toHaveAttribute('readonly')
    await expect.element(cell).not.toHaveAttribute('aria-haspopup')
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Edit this field in its own form')
    inputOf(cell).focus()
    await userEvent.keyboard('{F2}{Enter}')
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
    expect(moves).toEqual(['enter'])
})

test('the editor is a dialog named "Edit <field>", above sticky cells, unclipped', async () => {
    withEditor('LONG_TEXT', Stub)
    // The cell sits at the bottom of the screen, so the editor opens above it.
    await mountGrid([makeTable({ columns: ['Notes'], fields: [LONG_TEXT] })], {
        above: 'calc(100vh - 7rem)',
    })
    const cell = control(cellKey('t1r0', 'c0'))
    cell.focus({ preventScroll: true })
    await userEvent.keyboard('{Enter}')
    const editor = page.getByRole('dialog', { name: 'Edit Notes 2026-10-20' })
    await expect.element(editor).toBeVisible()
    await nextFrame()
    await nextFrame()
    const box = editor.element().getBoundingClientRect()
    const head = document.querySelector('thead')?.getBoundingClientRect()
    if (head === undefined) {
        throw new Error('No header')
    }
    expect(box.bottom).toBeLessThanOrEqual(cell.getBoundingClientRect().top + 1)
    // Over the sticky header, and not cut off by the table's scrolling region.
    expect(box.top).toBeLessThan(head.top)
    const shown = document.elementFromPoint(
        box.left + 8,
        (head.top + head.bottom) / 2
    )
    expect(editor.element().contains(shown)).toBe(true)
    expect((await visibleBox(editor.element())).top).toBeCloseTo(box.top, 0)
})

test('an editor near the right edge of a narrow screen opens towards the left, inside the screen', async () => {
    withEditor('LONG_TEXT', Stub)
    await page.viewport(360, 640)
    onTestFinished(() => page.viewport(1280, 720))
    const columns = ['First', 'Second', 'Third', 'Notes']
    await mountGrid([
        makeTable({
            columns,
            fields: [
                { valueType: 'TEXT' },
                { valueType: 'TEXT' },
                { valueType: 'TEXT' },
                LONG_TEXT,
            ],
        }),
    ])
    const cell = control(cellKey('t1r0', 'c3'))
    cell.scrollIntoView({ inline: 'end' })
    cell.focus()
    await userEvent.keyboard('{Enter}')
    const editor = page.getByRole('dialog', { name: 'Edit Notes 2026-10-20' })
    await expect.element(editor).toBeVisible()
    await nextFrame()
    await nextFrame()
    const box = editor.element().getBoundingClientRect()
    expect(box.right).toBeLessThanOrEqual(window.innerWidth + 1)
    expect(box.left).toBeGreaterThanOrEqual(-1)
})
