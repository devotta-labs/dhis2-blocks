import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { CELL, HEADER, rig } from './__tests__/harness'
import { Cell } from './Cell'

const BOOLEAN: Field = { valueType: 'BOOLEAN' }
const TRUE_ONLY: Field = { valueType: 'TRUE_ONLY' }

const mount = async (field: Field, options?: Parameters<typeof rig>[1]) => {
    const setup = rig(field, options)
    // Through `Cell`, which hands the control the rule's lock.
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
    return setup
}

const yesNo = () => page.getByRole('combobox', { name: 'Age (years)' })
const checkbox = () => page.getByRole('checkbox', { name: 'Age (years)' })

test('y, n and Delete set a Yes/No field; all four arrows move', async () => {
    const { stored, moves } = await mount(BOOLEAN)
    yesNo().element().focus()
    await userEvent.keyboard('n')
    expect(stored()?.value).toBe('false')
    await expect.element(yesNo()).toHaveDisplayValue('No')
    // Straight after 'n': the select's own type-ahead would look for "ny".
    await userEvent.keyboard('y')
    expect(stored()?.value).toBe('true')
    await expect.element(yesNo()).toHaveDisplayValue('Yes')
    await userEvent.keyboard('{Delete}')
    expect(stored()?.value).toBeUndefined()
    await userEvent.keyboard(
        '{ArrowDown}{ArrowUp}{ArrowLeft}{ArrowRight}{Enter}'
    )
    expect(moves).toEqual(['down', 'up', 'left', 'right', 'enter'])
    // Arrows only move: the value stays as it is.
    expect(stored()?.value).toBeUndefined()
})

test('a Yes/No field is also picked from its list', async () => {
    const { stored } = await mount(BOOLEAN)
    await userEvent.selectOptions(yesNo(), 'No')
    expect(stored()?.value).toBe('false')
})

test('Space toggles a checkbox; arrows move', async () => {
    const { stored, moves } = await mount(TRUE_ONLY)
    checkbox().element().focus()
    await userEvent.keyboard(' ')
    expect(stored()?.value).toBe('true')
    await expect.element(checkbox()).toBeChecked()
    await userEvent.keyboard(' ')
    expect(stored()?.value).toBeUndefined()
    await expect.element(checkbox()).not.toBeChecked()
    await userEvent.keyboard(
        '{ArrowDown}{ArrowUp}{ArrowLeft}{ArrowRight}{Enter}'
    )
    expect(moves).toEqual(['down', 'up', 'left', 'right', 'enter'])
})

test('Delete and Backspace clear a checkbox', async () => {
    const { stored } = await mount(TRUE_ONLY, { value: 'true' })
    checkbox().element().focus()
    await userEvent.keyboard('{Delete}')
    expect(stored()).toMatchObject({ value: undefined, sync: 'queued' })
    await expect.element(checkbox()).not.toBeChecked()
    await userEvent.keyboard(' {Backspace}')
    expect(stored()?.value).toBeUndefined()
})

test('a choice made as a rule locks the cell is not saved: the lock is read as it saves', async () => {
    const { effects, enqueued } = await mount(BOOLEAN)
    const control = yesNo().element()
    control.focus()
    // The rule locks the cell, and the key arrives before the cell is drawn again.
    effects.setState({
        cells: {
            [CELL]: {
                required: false,
                messages: [],
                readOnly: 'Assigned by rule: Smoker',
            },
        },
    })
    control.dispatchEvent(
        new KeyboardEvent('keydown', {
            key: 'y',
            bubbles: true,
            cancelable: true,
        })
    )
    expect(enqueued).toEqual([])
})

test('a locked Yes/No field takes no keys, still moves and says why', async () => {
    const reason = 'Assigned by rule: Smoker'
    const { stored, moves, enqueued } = await mount(BOOLEAN, {
        value: 'true',
        effects: { readOnly: reason },
    })
    await expect.element(yesNo()).toHaveAccessibleDescription(reason)
    await expect.element(yesNo()).toHaveAttribute('aria-readonly', 'true')
    yesNo().element().focus()
    await userEvent.keyboard('n{Delete}{ArrowRight}')
    expect(stored()?.value).toBe('true')
    expect(enqueued).toEqual([])
    expect(moves).toEqual(['right'])
})

test('a locked checkbox does not toggle', async () => {
    const { stored, enqueued } = await mount(TRUE_ONLY, {
        value: 'true',
        effects: { readOnly: 'Assigned by rule: Smoker' },
    })
    checkbox().element().focus()
    await userEvent.keyboard(' ')
    await userEvent.click(checkbox())
    await expect.element(checkbox()).toBeChecked()
    expect(stored()?.value).toBe('true')
    expect(enqueued).toEqual([])
})

const HIDDEN_BY = 'Hidden by rule: Hide when not pregnant'
const hide = (effects: ReturnType<typeof rig>['effects']) =>
    effects.setState({
        cells: {
            [CELL]: { required: false, messages: [], hiddenBy: HIDDEN_BY },
        },
    })

test('a rule that hides a Yes/No field keeps focus on the same control and names the rule', async () => {
    const { effects } = await mount(BOOLEAN, { value: 'true' })
    const control = yesNo().element()
    control.focus()
    hide(effects)
    await expect.element(yesNo()).toHaveDisplayValue('Hidden')
    await expect.element(yesNo()).toHaveAccessibleDescription(HIDDEN_BY)
    await expect.element(yesNo()).toHaveFocus()
    effects.setState({ cells: {} })
    await expect.element(yesNo()).toHaveDisplayValue('Yes')
    await expect.element(yesNo()).toHaveFocus()
    expect(yesNo().element()).toBe(control)
})

test('a rule that hides a checkbox keeps focus on the same control and names the rule', async () => {
    const { effects } = await mount(TRUE_ONLY, { value: 'true' })
    const control = checkbox().element()
    control.focus()
    hide(effects)
    await expect
        .element(page.getByText('Hidden', { exact: true }))
        .toBeVisible()
    // Neither checked nor not: the rule hid the answer.
    await expect.element(checkbox()).toBePartiallyChecked()
    await expect.element(checkbox()).toHaveAccessibleDescription(HIDDEN_BY)
    await expect.element(checkbox()).toHaveFocus()
    effects.setState({ cells: {} })
    await expect.element(checkbox()).toBeChecked()
    await expect.element(checkbox()).not.toBePartiallyChecked()
    await expect.element(checkbox()).toHaveFocus()
    expect(checkbox().element()).toBe(control)
})
