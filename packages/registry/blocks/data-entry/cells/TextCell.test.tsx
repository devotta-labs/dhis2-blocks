import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { CELL, HEADER, inputOf, rig } from './__tests__/harness'
import { cellDomId } from './cellProps'
import { TextCell } from './TextCell'

const INTEGER: Field = { valueType: 'INTEGER' }
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

const mount = async (options?: Parameters<typeof rig>[1], field = INTEGER) => {
    const setup = rig(field, options)
    await render(
        setup.ui(
            <TextCell
                id={cellDomId(CELL)}
                cellKey={CELL}
                field={field}
                labelledBy={HEADER}
                move={setup.move}
            />
        )
    )
    const input = page.getByRole('textbox', { name: 'Age (years)' })
    const caret = () => getComputedStyle(inputOf(input)).caretColor
    return { ...setup, input, caret }
}

test('typing in Ready replaces the value', async () => {
    const { input, caret, moves, stored } = await mount({ value: '123' })
    inputOf(input).focus()
    // Ready: the cell is selected, but no cursor shows.
    expect(caret()).toBe(TRANSPARENT)
    await userEvent.keyboard('7')
    expect(caret()).not.toBe(TRANSPARENT)
    await expect.element(input).toHaveValue('7')
    await userEvent.keyboard('{Enter}')
    expect(stored()).toMatchObject({ value: '7', sync: 'queued' })
    expect(moves).toEqual(['enter'])
})

test('F2 edits inside the text: left and right move the caret', async () => {
    const { input, moves, stored } = await mount({ value: '123' })
    inputOf(input).focus()
    await userEvent.keyboard('{F2}')
    expect(inputOf(input).selectionStart).toBe(3)
    await userEvent.keyboard('{ArrowLeft}9{Enter}')
    expect(stored()?.value).toBe('1293')
    expect(moves).toEqual(['enter'])
})

test('Escape reverts unsaved typing', async () => {
    const { input, enqueued, stored } = await mount({ value: '123' })
    inputOf(input).focus()
    await userEvent.keyboard('99')
    await expect.element(input).toHaveValue('99')
    await userEvent.keyboard('{Escape}')
    await expect.element(input).toHaveValue('123')
    expect(enqueued).toEqual([])
    // Back in Ready, so the next typing replaces the value again.
    await userEvent.keyboard('5{Enter}')
    expect(stored()?.value).toBe('5')
})

test('arrows in Ready move between cells; in Edit they move the caret', async () => {
    const { input, moves } = await mount({ value: '123' })
    inputOf(input).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(moves).toEqual(['right'])
    await userEvent.keyboard('{F2}{ArrowLeft}{ArrowRight}{ArrowLeft}')
    expect(moves).toEqual(['right'])
    expect(inputOf(input).selectionStart).toBe(2)
    // Up and down still save and move in Edit.
    await userEvent.keyboard('{ArrowDown}')
    expect(moves).toEqual(['right', 'down'])
})

test('arrows in Enter save the typing and move', async () => {
    const { input, moves, stored } = await mount({ value: '123' })
    inputOf(input).focus()
    await userEvent.keyboard('8{ArrowLeft}')
    expect(stored()?.value).toBe('8')
    expect(moves).toEqual(['left'])
})

test('an invalid value is described and marked invalid', async () => {
    const { input, moves, enqueued, stored } = await mount()
    inputOf(input).focus()
    await userEvent.keyboard('abc{Enter}')
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect
        .element(input)
        .toHaveAccessibleDescription('Enter a whole number')
    // Nothing typed is lost.
    await expect.element(input).toHaveValue('abc')
    expect(stored()?.draft).toBe('abc')
    expect(enqueued).toEqual([])
    // The person stays to fix it, in Edit mode: the cursor moves in the text.
    expect(moves).toEqual([])
    await expect.element(input).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(moves).toEqual([])
    expect(inputOf(input).selectionStart).toBe(2)
})

test('an arrow does not leave an invalid value either; Tab does', async () => {
    const { input, moves, stored } = await mount()
    inputOf(input).focus()
    await userEvent.keyboard('abc{ArrowDown}')
    expect(moves).toEqual([])
    expect(stored()?.error).toBe('Enter a whole number')
    await userEvent.keyboard('{Tab}')
    expect(moves).toEqual(['tab'])
    expect(stored()?.draft).toBe('abc')
})

test('Tab saves the typing and tells the grid, leaving the move to the browser', async () => {
    const { input, moves, stored } = await mount()
    inputOf(input).focus()
    const tab = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
    })
    await userEvent.keyboard('4')
    inputOf(input).dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    expect(stored()?.value).toBe('4')
    expect(moves).toEqual(['tab'])
})

test('leaving the cell saves the typing', async () => {
    const { input, stored } = await mount({ value: '1' })
    inputOf(input).focus()
    await userEvent.keyboard('6')
    inputOf(input).blur()
    expect(stored()?.value).toBe('6')
})

test('moving through a cell without typing saves nothing', async () => {
    const { input, enqueued } = await mount({ value: '1' })
    inputOf(input).focus()
    await userEvent.keyboard('{ArrowDown}{Enter}{Tab}')
    inputOf(input).blur()
    expect(enqueued).toEqual([])
})

test('double-clicking edits with the cursor at the end', async () => {
    const { input, caret, moves } = await mount({ value: '123' })
    await userEvent.dblClick(input)
    expect(caret()).not.toBe(TRANSPARENT)
    expect(inputOf(input).selectionStart).toBe(3)
    await userEvent.keyboard('{ArrowLeft}')
    expect(moves).toEqual([])
})

test('clicking the selected cell edits it', async () => {
    const { input, caret, moves } = await mount({ value: '123' })
    inputOf(input).focus()
    expect(caret()).toBe(TRANSPARENT)
    await userEvent.click(input)
    expect(caret()).not.toBe(TRANSPARENT)
    await userEvent.keyboard('{ArrowLeft}')
    expect(moves).toEqual([])
})

test('Enter while composing text belongs to the input method', async () => {
    const { input, moves, stored } = await mount({ value: '1' })
    inputOf(input).focus()
    inputOf(input).dispatchEvent(
        new KeyboardEvent('keydown', {
            key: 'Enter',
            isComposing: true,
            bubbles: true,
        })
    )
    // Safari ends composition with a keydown that reports keyCode 229 instead.
    inputOf(input).dispatchEvent(
        new KeyboardEvent('keydown', {
            key: 'Enter',
            keyCode: 229,
            bubbles: true,
        })
    )
    expect(moves).toEqual([])
    expect(stored()?.sync).toBe('idle')
})

test('Escape in the middle of a composition does not revert the typing', async () => {
    const { input } = await mount({ value: '123' })
    inputOf(input).focus()
    await userEvent.keyboard('9')
    inputOf(input).dispatchEvent(
        new KeyboardEvent('keydown', {
            key: 'Escape',
            isComposing: true,
            bubbles: true,
        })
    )
    await expect.element(input).toHaveValue('9')
})

test('a click into the cell selects it, so typing replaces the value', async () => {
    const { input, caret, stored } = await mount({ value: '123' })
    // On the text, where a click would otherwise place the cursor.
    await userEvent.click(input, { position: { x: 16, y: 10 } })
    await expect.element(input).toHaveFocus()
    expect(caret()).toBe(TRANSPARENT)
    await userEvent.keyboard('7{Enter}')
    expect(stored()?.value).toBe('7')
})

test('a mouse press on an unfocused cell is taken over, so no browser puts a cursor after the selection', async () => {
    const { input } = await mount({ value: '123' })
    const press = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
    })
    inputOf(input).dispatchEvent(press)
    expect(press.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(inputOf(input))
})

test('clicking inside the text while typing edits it', async () => {
    const { input, moves } = await mount({ value: '123' })
    inputOf(input).focus()
    await userEvent.keyboard('45')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowLeft}')
    expect(moves).toEqual([])
})

test('an invalid cell still shows where focus is', async () => {
    const { input } = await mount()
    const shadow = () => getComputedStyle(inputOf(input)).boxShadow
    const BLUE = 'rgb(20, 124, 215)'
    const RED = 'rgb(198, 40, 40)'
    inputOf(input).focus()
    await userEvent.keyboard('abc{Enter}')
    expect(shadow()).toContain(BLUE)
    expect(shadow()).not.toContain(RED)
    inputOf(input).blur()
    expect(shadow()).toContain(RED)
})

test('Escape after an invalid save discards the draft and its error', async () => {
    const { input, stored, enqueued } = await mount({ value: '123' })
    inputOf(input).focus()
    await userEvent.keyboard('abc{Enter}{Escape}')
    await expect.element(input).toHaveValue('123')
    await expect.element(input).not.toHaveAttribute('aria-invalid')
    expect(stored()?.draft).toBeUndefined()
    expect(enqueued).toEqual([])
})

test('Escape hides the notes before it discards anything', async () => {
    const { input, stored } = await mount({ value: '123' })
    const note = page.getByText('Enter a whole number')
    inputOf(input).focus()
    await userEvent.keyboard('abc{Enter}')
    // Back in Ready on the cell that holds the refused text.
    inputOf(input).blur()
    inputOf(input).focus()
    await expect.element(note).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(note).not.toBeVisible()
    await expect.element(input).toHaveValue('abc')
    // The notes are still the cell's description.
    await expect
        .element(input)
        .toHaveAccessibleDescription('Enter a whole number')
    await userEvent.keyboard('{Escape}')
    await expect.element(input).toHaveValue('123')
    expect(stored()?.draft).toBeUndefined()
})

test('notes hidden with Escape come back when the cell is focused again', async () => {
    const { input } = await mount({ value: 'abc' })
    const note = page.getByText('Enter a whole number')
    inputOf(input).focus()
    await expect.element(note).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(note).not.toBeVisible()
    inputOf(input).blur()
    inputOf(input).focus()
    await expect.element(note).toBeVisible()
})

test('after saving at the grid edge, where nothing moves, the cell is selected again', async () => {
    const { input, caret, stored } = await mount({ value: '1' })
    inputOf(input).focus()
    await userEvent.keyboard('5{Enter}')
    expect(stored()?.value).toBe('5')
    expect(caret()).toBe(TRANSPARENT)
    await userEvent.keyboard('6{Enter}')
    expect(stored()?.value).toBe('6')
})

test('the control has the id the grid focuses by and asks for the numeric keyboard', async () => {
    const { input } = await mount(undefined, { valueType: 'INTEGER_POSITIVE' })
    expect(inputOf(input).id).toBe(cellDomId(CELL))
    await expect.element(input).toHaveAttribute('inputmode', 'numeric')
})

test('a date is typed and shown in the calendar', async () => {
    const { input, stored } = await mount(undefined, { valueType: 'DATE' })
    inputOf(input).focus()
    await userEvent.keyboard('2026-10-20{Enter}')
    expect(stored()?.value).toBe('2026-10-20')
    await expect.element(input).toHaveValue('2026-10-20')
})

test('an invalid save shows its error even after the notes were hidden', async () => {
    const { input } = await mount({
        value: '1',
        effects: {
            messages: [
                { kind: 'warning', text: 'Check the age', source: 'rule' },
            ],
        },
    })
    inputOf(input).focus()
    await userEvent.keyboard('{Escape}')
    await expect.element(page.getByText('Check the age')).not.toBeVisible()
    await userEvent.keyboard('abc{Enter}')
    await expect.element(page.getByText('Enter a whole number')).toBeVisible()
})
