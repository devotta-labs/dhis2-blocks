/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { CELL, HEADER, inputOf, rig } from '../__tests__/harness'
import { Cell } from '../Cell'

const FRUIT: Field = {
    valueType: 'MULTI_TEXT',
    options: [
        { code: 'A', name: 'Apple' },
        { code: 'B', name: 'Banana' },
        { code: 'C', name: 'Cherry' },
        { code: 'D', name: 'Date' },
    ],
}
const MANY: Field = {
    valueType: 'MULTI_TEXT',
    options: Array.from({ length: 60 }, (_, i) => ({
        code: `O${i}`,
        name: `Option ${i}`,
    })),
}

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
const search = dialog.getByRole('searchbox')
const checkbox = (name: string) => dialog.getByRole('checkbox', { name })
const save = () => page.getByRole('button', { name: 'Save' })

test('search narrows the options; checking saves codes in option-set order joined by commas', async () => {
    const { cell, stored, enqueued } = await mount(FRUIT)
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(search).toHaveFocus()
    expect(dialog.getByRole('checkbox').all()).toHaveLength(4)

    // C first, then A: the saved value follows the option set, not the order of the clicks.
    await userEvent.click(checkbox('Cherry'))
    await expect.element(checkbox('Cherry')).toBeChecked()
    await userEvent.fill(search, 'app')
    expect(dialog.getByRole('checkbox').all()).toHaveLength(1)
    await userEvent.click(checkbox('Apple'))
    // A pick is not a save, and a choice made before the search stays.
    expect(enqueued).toEqual([])
    await userEvent.fill(search, '')
    await expect.element(checkbox('Apple')).toBeChecked()
    await expect.element(checkbox('Cherry')).toBeChecked()
    await userEvent.click(save())
    expect(stored()?.value).toBe('A,C')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
})

test('leaving the editor saves the selection it last reported', async () => {
    const { cell, stored } = await mount(FRUIT, { value: 'B' })
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(checkbox('Banana')).toBeChecked()
    await userEvent.click(checkbox('Date'))
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('B,D')
})

test('Space toggles the focused checkbox', async () => {
    const { cell, stored } = await mount(FRUIT)
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(search).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect.element(checkbox('Apple')).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect.element(checkbox('Apple')).toBeChecked()
    await userEvent.keyboard('{Tab} ')
    await expect.element(checkbox('Banana')).toBeChecked()
    await userEvent.keyboard('{Shift>}{Tab}{/Shift} ')
    await expect.element(checkbox('Apple')).not.toBeChecked()
    await userEvent.click(save())
    expect(stored()?.value).toBe('B')
})

test('options a rule hid are not offered, and a stored hidden option can still be unchecked', async () => {
    const { cell, stored } = await mount(FRUIT, {
        value: 'A,C',
        effects: { hiddenOptions: new Set(['B', 'C']) },
    })
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(checkbox('Banana')).not.toBeInTheDocument()
    await expect.element(checkbox('Cherry')).toBeChecked()
    await userEvent.click(checkbox('Cherry'))
    await expect.element(checkbox('Cherry')).not.toBeChecked()
    // Still listed, so the person can see what they unchecked.
    await expect.element(checkbox('Cherry')).toBeVisible()
    await userEvent.click(save())
    expect(stored()?.value).toBe('A')
})

test('"Clear all" saves no value; the selection is announced as "Selected options: …"', async () => {
    const { cell, stored, announced } = await mount(FRUIT, { value: 'A,C' })
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.click(checkbox('Date'))
    expect(announced).toContain('Selected options: Apple, Cherry, Date')
    await userEvent.click(checkbox('Apple'))
    expect(announced).toContain('Selected options: Cherry, Date')
    // With nothing left selected, nothing is announced.
    await userEvent.click(checkbox('Cherry'))
    await userEvent.click(checkbox('Date'))
    expect(announced).not.toContain('Selected options: ')

    await userEvent.click(page.getByRole('button', { name: 'Clear all' }))
    expect(stored()?.value).toBeUndefined()
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
})

test('at most 50 options are listed, with the count line; a search that finds none says so', async () => {
    const { cell, announced } = await mount(MANY)
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    expect(dialog.getByRole('checkbox').all()).toHaveLength(50)
    const count = 'Showing 50 of 60 matches'
    await expect.element(dialog.getByText(count)).toBeVisible()
    expect(announced).toContain(count)
    // Listed in the option set's order, not ranked: "Option 15" holds a 5 but no word starts with it.
    await userEvent.fill(search, 'option 5')
    expect(dialog.getByRole('checkbox').all()).toHaveLength(15)
    await expect
        .element(dialog.getByRole('checkbox').first())
        .toHaveAccessibleName('Option 5')
    await expect
        .element(dialog.getByRole('checkbox').nth(1))
        .toHaveAccessibleName('Option 15')
    await expect.element(dialog.getByText(count)).not.toBeInTheDocument()

    await userEvent.fill(search, 'zzz')
    await expect.element(dialog.getByText('No matches')).toBeVisible()
    expect(announced).toContain('No matches')
})
