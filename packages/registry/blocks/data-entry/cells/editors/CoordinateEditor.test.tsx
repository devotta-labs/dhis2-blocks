/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import type { Locator } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { CELL, HEADER, inputOf, rig } from '../__tests__/harness'
import { Cell } from '../Cell'

const COORDINATE: Field = { valueType: 'COORDINATE' }
const LATITUDE = 'Enter a latitude between -90 and 90'
const LONGITUDE = 'Enter a longitude between -180 and 180'

const mount = async (options?: Parameters<typeof rig>[1]) => {
    const setup = rig(COORDINATE, options)
    await render(
        setup.ui(
            <Cell
                cellKey={CELL}
                field={COORDINATE}
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
const latitude = dialog.getByRole('textbox', { name: 'Latitude' })
const longitude = dialog.getByRole('textbox', { name: 'Longitude' })
const save = () => page.getByRole('button', { name: 'Save' })

// F2, not Enter: the Enter right after a save moves on.
const open = async (cell: Locator) => {
    inputOf(cell).focus()
    await userEvent.keyboard('{F2}')
}

test('latitude and longitude save as [lng,lat]', async () => {
    const { cell, stored, enqueued } = await mount()
    await open(cell)
    await expect.element(latitude).toHaveFocus()
    await userEvent.fill(latitude, '8.2')
    await userEvent.fill(longitude, '-11.4')
    // A change is not a save.
    expect(enqueued).toEqual([])
    await userEvent.click(save())
    expect(stored()?.value).toBe('[-11.4,8.2]')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
    // Shown as DHIS2 displays it: latitude first.
    await expect.element(cell).toHaveValue('8.2, -11.4')

    // The editor opens on the stored value, and the edge values are coordinates.
    await open(cell)
    await expect.element(latitude).toHaveValue('8.2')
    await expect.element(longitude).toHaveValue('-11.4')
    await userEvent.fill(latitude, '-90')
    await userEvent.fill(longitude, '180')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('[180,-90]')

    await open(cell)
    await userEvent.fill(latitude, '90')
    await userEvent.fill(longitude, '-180')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')
    expect(stored()?.value).toBe('[-180,90]')
})

test('out-of-range values are refused with their messages', async () => {
    const { cell, stored, enqueued } = await mount()
    await open(cell)
    await userEvent.fill(latitude, '91')
    await userEvent.fill(longitude, '-11.4')
    // Nothing is said while the numbers are typed.
    await expect.element(dialog.getByText(LATITUDE)).not.toBeInTheDocument()
    await userEvent.click(save())
    await expect.element(dialog.getByText(LATITUDE)).toBeVisible()
    await expect.element(latitude).toHaveAttribute('aria-invalid', 'true')
    await expect.element(longitude).not.toHaveAttribute('aria-invalid')
    await expect.element(latitude).toHaveFocus()
    await expect.element(dialog).toBeVisible()
    expect(enqueued).toEqual([])

    // Each message is about its own field, and focus goes to it.
    await userEvent.fill(latitude, '8.2')
    await expect.element(dialog.getByText(LATITUDE)).not.toBeInTheDocument()
    await userEvent.fill(longitude, '181')
    await userEvent.click(save())
    await expect.element(dialog.getByText(LONGITUDE)).toBeVisible()
    await expect.element(longitude).toHaveAttribute('aria-invalid', 'true')
    await expect.element(longitude).toHaveFocus()

    // Both wrong: both are said, and focus goes to the first.
    await userEvent.fill(latitude, '-91')
    await userEvent.click(save())
    await expect.element(dialog.getByText(LATITUDE)).toBeVisible()
    await expect.element(dialog.getByText(LONGITUDE)).toBeVisible()
    await expect.element(latitude).toHaveFocus()

    // Text that is no number, and one number without the other, are refused too.
    await userEvent.fill(latitude, 'north')
    await userEvent.fill(longitude, '-11.4')
    await userEvent.click(save())
    await expect.element(dialog.getByText(LATITUDE)).toBeVisible()
    await userEvent.fill(latitude, '')
    await userEvent.click(save())
    await expect.element(dialog.getByText(LATITUDE)).toBeVisible()
    await userEvent.fill(latitude, '8.2')
    await userEvent.fill(longitude, '')
    await userEvent.click(save())
    await expect.element(dialog.getByText(LONGITUDE)).toBeVisible()
    await expect.element(dialog.getByText(LATITUDE)).not.toBeInTheDocument()
    expect(enqueued).toEqual([])
    expect(stored()?.value).toBeUndefined()
})

test('leaving the editor saves what was typed, or keeps it in the cell when it cannot be saved; both fields empty clear the value', async () => {
    const { cell, stored, enqueued } = await mount({ value: '[-11.4,8.2]' })
    await open(cell)
    await userEvent.fill(longitude, '-12')
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('[-12,8.2]')

    // Kept as `lat, lng`, as a coordinate is typed, with the editor's message; nothing is saved.
    await open(cell)
    await userEvent.fill(latitude, '95')
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()).toMatchObject({
        value: '[-12,8.2]',
        draft: '95, -12',
        error: LATITUDE,
    })
    await expect.element(cell).toHaveValue('95, -12')
    await expect.element(cell).toHaveAttribute('aria-invalid', 'true')
    // Beside the cell's other notes, such as whether its value is saved.
    await expect.element(cell).toHaveAccessibleDescription(new RegExp(LATITUDE))
    expect(enqueued).toHaveLength(1)
    // Escape on the cell drops it.
    inputOf(cell).focus()
    await userEvent.keyboard('{Escape}{Escape}')
    expect(stored()).toMatchObject({ draft: undefined, error: undefined })
    await expect.element(cell).toHaveValue('8.2, -12')

    await open(cell)
    await userEvent.fill(latitude, '')
    await userEvent.fill(longitude, '')
    await userEvent.click(save())
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBeUndefined()

    // Cancel closes without saving.
    await open(cell)
    await userEvent.fill(latitude, '1')
    await userEvent.fill(longitude, '2')
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBeUndefined()
})

test('numbers are read as number cells read them', async () => {
    const { cell, stored } = await mount()
    await open(cell)
    // A bare point or a leading one is read, and stored in the form DHIS2 takes.
    await userEvent.fill(latitude, '.5')
    await userEvent.fill(longitude, '-5.')
    await userEvent.click(save())
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('[-5,0.5]')

    // A plus sign is no number there, so it is none here.
    await open(cell)
    await userEvent.fill(latitude, '+8')
    await userEvent.click(save())
    await expect.element(dialog.getByText(LATITUDE)).toBeVisible()
    await userEvent.fill(latitude, '8')
    await userEvent.fill(longitude, '+1')
    await userEvent.click(save())
    await expect.element(dialog.getByText(LONGITUDE)).toBeVisible()
    expect(stored()?.value).toBe('[-5,0.5]')
})
