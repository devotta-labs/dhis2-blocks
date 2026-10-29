/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { CELL, HEADER, inputOf, rig } from '../__tests__/harness'
import { Cell } from '../Cell'

const LONG_TEXT: Field = { valueType: 'LONG_TEXT' }
const MASKED: Field = { valueType: 'LONG_TEXT', fieldMask: '\\d{3}' }
const BAD_FORMAT = 'Enter a value in the required format'

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
const text = dialog.getByRole('textbox')

test('Enter adds a line; Ctrl+Enter and ⌘+Enter save; the hint says so', async () => {
    const { cell, stored, enqueued } = await mount(LONG_TEXT, {
        value: 'Seen',
    })
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(text).toHaveValue('Seen')
    await expect.element(text).toHaveFocus()
    // The cursor opens at the end of the text.
    await userEvent.keyboard('{Enter}at home')
    await expect.element(text).toHaveValue('Seen\nat home')
    expect(enqueued).toEqual([])
    await expect
        .element(dialog.getByText('Ctrl+Enter or ⌘+Enter saves'))
        .toBeVisible()
    await expect
        .element(text)
        .toHaveAccessibleDescription('Ctrl+Enter or ⌘+Enter saves')

    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(stored()?.value).toBe('Seen\nat home')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()

    await userEvent.keyboard('{F2}')
    await userEvent.keyboard('!{Meta>}{Enter}{/Meta}')
    expect(stored()?.value).toBe('Seen\nat home!')
    await expect.element(dialog).not.toBeInTheDocument()

    // Emptied text clears the value.
    await userEvent.keyboard('{F2}')
    await userEvent.fill(text, '')
    await userEvent.click(page.getByRole('button', { name: 'Save' }))
    expect(stored()?.value).toBeUndefined()
})

test('opening with a typed key starts the text with that key, cursor at the end', async () => {
    const { cell, stored } = await mount(LONG_TEXT, { value: 'Some notes' })
    inputOf(cell).focus()
    await userEvent.keyboard('a')
    await expect.element(text).toHaveValue('a')
    await userEvent.keyboard('bc')
    await expect.element(text).toHaveValue('abc')
    // Text that is typed and not yet saved is kept when focus leaves the editor.
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('abc')

    // Without a key, the editor opens on the stored text, the cursor at its end.
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    const area = text.element()
    if (!(area instanceof HTMLTextAreaElement)) {
        throw new Error('Expected a textarea')
    }
    expect(area.selectionStart).toBe(3)
    expect(area.selectionEnd).toBe(3)
})

test('a field mask is checked on save and keeps the editor open with the message', async () => {
    const { cell, stored, enqueued } = await mount(MASKED, {
        value: '123',
    })
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.fill(text, '12')
    // Nothing is said while the text is typed.
    await expect.element(dialog.getByText(BAD_FORMAT)).not.toBeInTheDocument()
    await userEvent.click(page.getByRole('button', { name: 'Save' }))
    await expect.element(dialog.getByText(BAD_FORMAT)).toBeVisible()
    await expect.element(text).toHaveAttribute('aria-invalid', 'true')
    await expect.element(dialog).toBeVisible()
    expect(enqueued).toEqual([])
    // Focus goes back to the text the message is about.
    await expect.element(text).toHaveFocus()
    // Ctrl+Enter is checked the same way.
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    await expect.element(dialog).toBeVisible()
    expect(enqueued).toEqual([])

    // Typing again takes the message away; the matching text saves.
    await userEvent.fill(text, '456')
    await expect.element(dialog.getByText(BAD_FORMAT)).not.toBeInTheDocument()
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('456')

    // Focus leaving with text the mask refuses keeps it in the cell, refused, and saves nothing. (The next Enter would
    // move on.)
    await userEvent.keyboard('{F2}')
    await userEvent.fill(text, '7')
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()).toMatchObject({
        value: '456',
        draft: '7',
        error: BAD_FORMAT,
    })
    await expect.element(cell).toHaveValue('7')
    await expect.element(cell).toHaveAttribute('aria-invalid', 'true')
    // Beside the cell's other notes, such as whether its value is saved.
    await expect
        .element(cell)
        .toHaveAccessibleDescription(new RegExp(BAD_FORMAT))
    expect(enqueued).toHaveLength(1)
    // Escape on the cell drops it.
    inputOf(cell).focus()
    await userEvent.keyboard('{Escape}{Escape}')
    expect(stored()).toMatchObject({ draft: undefined, error: undefined })
    await expect.element(cell).toHaveValue('456')
})
