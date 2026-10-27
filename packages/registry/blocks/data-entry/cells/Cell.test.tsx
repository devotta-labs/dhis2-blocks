import i18n from '@dhis2/d2-i18n'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { useCellView } from '../provider/context'
import { CELL, HEADER, inputOf, rig } from './__tests__/harness'
import type { CellComponent } from './cellProps'
import { Cell } from './Cell'

const mount = async (
    field: Field,
    options?: Parameters<typeof rig>[1],
    closedReason?: string
) => {
    const setup = rig(field, options)
    await render(
        setup.ui(
            <Cell
                cellKey={CELL}
                field={field}
                labelledBy={HEADER}
                move={setup.move}
                closedReason={closedReason}
            />
        )
    )
    return {
        ...setup,
        cell: page.getByRole('textbox', { name: 'Age (years)' }),
    }
}

const INTEGER: Field = { valueType: 'INTEGER' }

test('a read-only cell is focusable and says why', async () => {
    const reason = 'Assigned by rule: Calculate gestational age from LMP'
    const { cell, moves, enqueued } = await mount(INTEGER, {
        value: '12',
        effects: { readOnly: reason },
    })
    await expect.element(cell).toHaveValue('12')
    await expect.element(cell).toHaveAttribute('readonly')
    expect(inputOf(cell).tabIndex).toBe(0)
    await expect.element(cell).toHaveAccessibleDescription(reason)
    inputOf(cell).focus()
    await expect.element(cell).toHaveFocus()
    // It takes no typing, and still moves with the keys.
    await userEvent.keyboard('7{Enter}{ArrowRight}')
    await expect.element(cell).toHaveValue('12')
    expect(enqueued).toEqual([])
    expect(moves).toEqual(['enter', 'right'])
})

test('a hidden cell names the rule', async () => {
    const reason = 'Hidden by rule: Hide when not pregnant'
    const { cell } = await mount(INTEGER, {
        value: '12',
        effects: { hiddenBy: reason, readOnly: 'Assigned by rule: Other' },
    })
    await expect.element(cell).toHaveValue('Hidden')
    await expect.element(cell).toHaveAccessibleDescription(reason)
})

test('a saved-on-this-device cell says so', async () => {
    const { cell, store } = await mount(INTEGER)
    await expect.element(cell).not.toHaveAccessibleDescription(/./)
    store.getState().commit(CELL, '5')
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Saved on this device')
})

test('a cell that failed to save gives the reason', async () => {
    const { cell, store } = await mount(INTEGER)
    store.getState().commit(CELL, '5')
    store
        .getState()
        .markSync([{ key: CELL, value: '5' }], 'failed', 'Server said no')
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Not saved: Server said no')
})

test('a cell waiting for required fields gives the reason and says it is on this device', async () => {
    const { cell, store } = await mount(INTEGER)
    store.getState().commit(CELL, '5')
    store
        .getState()
        .markSync(
            [{ key: CELL, value: '5' }],
            'waiting',
            'Waiting for required fields: Event date'
        )
    await expect
        .element(cell)
        .toHaveAccessibleDescription(
            'Waiting for required fields: Event date Saved on this device'
        )
})

test('rule errors mark the cell invalid, warnings only describe it, required is announced', async () => {
    const { cell } = await mount(INTEGER, {
        value: '3',
        effects: {
            required: true,
            messages: [
                { kind: 'error', text: 'Too young', source: 'rule' },
                { kind: 'warning', text: 'Check the age', source: 'rule' },
            ],
        },
    })
    await expect.element(cell).toBeRequired()
    await expect.element(cell).toHaveAttribute('aria-invalid', 'true')
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Too young Check the age')
})

test('a warning alone leaves the cell valid', async () => {
    const { cell } = await mount(INTEGER, {
        value: '3',
        effects: {
            messages: [
                { kind: 'warning', text: 'Check the age', source: 'rule' },
            ],
        },
    })
    await expect.element(cell).not.toHaveAttribute('aria-invalid')
    await expect.element(cell).toHaveAccessibleDescription('Check the age')
})

test('a saved value that breaks the field rules is described, and not invalid', async () => {
    const { cell } = await mount(INTEGER, { value: 'abc' })
    await expect.element(cell).not.toHaveAttribute('aria-invalid')
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Enter a whole number')
})

test('pop-up kinds show their value read-only and point to their own form', async () => {
    const { cell } = await mount(
        { valueType: 'LONG_TEXT' },
        { value: 'Some notes' }
    )
    await expect.element(cell).toHaveValue('Some notes')
    await expect.element(cell).toHaveAttribute('readonly')
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Edit this field in its own form')
})

test('a multi-text option field stays read-only and points to its own form', async () => {
    const { cell } = await mount(
        {
            valueType: 'MULTI_TEXT',
            options: [
                { code: 'A', name: 'Alpha' },
                { code: 'B', name: 'Beta' },
            ],
        },
        { value: 'A,B' }
    )
    await expect.element(cell).toHaveAttribute('readonly')
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Edit this field in its own form')
})

test('a value type nothing can edit is read-only with the same reason', async () => {
    const { cell } = await mount({ valueType: 'REFERENCE' })
    await expect.element(cell).toHaveAttribute('readonly')
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Edit this field in its own form')
})

/** A replacement control that shows what the cell hands it. */
const Probe: CellComponent = ({ id, readOnly, hidden }) => (
    <p id={id}>{`readOnly: ${readOnly ?? 'none'}, hidden: ${hidden}`}</p>
)

test('a replacement control is not told a pop-up or unknown type is edited elsewhere', async () => {
    await mount(
        { valueType: 'LONG_TEXT' },
        { overrides: { valueTypes: { LONG_TEXT: Probe } } }
    )
    await expect
        .element(page.getByText('readOnly: none, hidden: false'))
        .toBeVisible()
})

test('a replacement for a field of an unknown type is not told so either', async () => {
    await mount(
        { valueType: 'REFERENCE' },
        { overrides: { fields: { c1: Probe } } }
    )
    await expect
        .element(page.getByText('readOnly: none, hidden: false'))
        .toBeVisible()
})

test('a replacement control gets the lock a rule puts on the cell', async () => {
    await mount(
        { valueType: 'LONG_TEXT' },
        {
            overrides: { valueTypes: { LONG_TEXT: Probe } },
            effects: { readOnly: 'Assigned by rule: Notes' },
        }
    )
    await expect
        .element(page.getByText('readOnly: Assigned by rule: Notes'))
        .toBeVisible()
})

test('a replacement control gets the id the grid finds the cell by', async () => {
    await mount(INTEGER, { overrides: { valueTypes: { INTEGER: Probe } } })
    await expect
        .element(page.getByText('readOnly: none'))
        .toHaveAttribute('id', 'data-entry-cell-r1.c1')
})

test('a closed cell has no control and says its reason', async () => {
    await mount(INTEGER, undefined, 'Not used')
    await expect.element(page.getByRole('textbox')).not.toBeInTheDocument()
    await expect.element(page.getByText('Not used')).toBeInTheDocument()
})

test('an editable value type gets the typed cell', async () => {
    const { cell, stored } = await mount(INTEGER, { value: '1' })
    await expect.element(cell).not.toHaveAttribute('readonly')
    inputOf(cell).focus()
    await userEvent.keyboard('2{Enter}')
    expect(stored()?.value).toBe('2')
})

test('a rule that hides or locks a cell keeps focus on the same control', async () => {
    const { cell, effects } = await mount(INTEGER, { value: '12' })
    const control = inputOf(cell)
    control.focus()
    await expect.element(cell).toHaveFocus()

    effects.setState({
        cells: {
            [CELL]: {
                required: false,
                messages: [],
                hiddenBy: 'Hidden by rule: Hide when not pregnant',
            },
        },
    })
    await expect.element(cell).toHaveValue('Hidden')
    await expect.element(cell).toHaveFocus()
    expect(inputOf(cell)).toBe(control)

    effects.setState({
        cells: {
            [CELL]: {
                required: false,
                messages: [],
                readOnly: 'Assigned by rule: Calculate age',
            },
        },
    })
    await expect.element(cell).toHaveValue('12')
    await expect.element(cell).toHaveAttribute('readonly')
    await expect.element(cell).toHaveFocus()

    effects.setState({ cells: {} })
    await expect.element(cell).not.toHaveAttribute('readonly')
    await expect.element(cell).toHaveFocus()
    expect(inputOf(cell)).toBe(control)
})

test('typing that a rule locks away is not written', async () => {
    const { cell, effects, enqueued } = await mount(INTEGER, { value: '12' })
    inputOf(cell).focus()
    await userEvent.keyboard('9')
    effects.setState({
        cells: {
            [CELL]: {
                required: false,
                messages: [],
                readOnly: 'Assigned by rule: Calculate age',
            },
        },
    })
    await expect.element(cell).toHaveValue('12')
    inputOf(cell).blur()
    expect(enqueued).toEqual([])
})

test('text typed into a cell a rule then hides and locks is not saved', async () => {
    const { cell, effects, stored } = await mount(INTEGER, { value: '1' })
    inputOf(cell).focus()
    await userEvent.keyboard('5')
    effects.setState({
        cells: {
            [CELL]: {
                required: false,
                messages: [],
                hiddenBy: 'Hidden by rule: Hide when not pregnant',
                readOnly: 'Completed events in this stage cannot be edited',
            },
        },
    })
    inputOf(cell).blur()
    await expect.element(cell).toHaveValue('Hidden')
    expect(stored()?.value).toBe('1')
})

/** A replacement that puts what the cell hands it on its own focusable element. */
const Notes: CellComponent = ({ id, cellKey, labelledBy, aria }) => {
    const { value, commit } = useCellView(cellKey)
    return (
        <textarea
            id={id}
            aria-labelledby={labelledBy}
            {...aria}
            defaultValue={value}
            onBlur={(event) => commit(event.target.value)}
        />
    )
}

test('a replacement control is described as the default controls are: required, saved, refused', async () => {
    i18n.addResources('xx', 'translation', {
        'Enter a whole number': 'Saisissez un nombre entier',
    })
    await i18n.changeLanguage('xx')
    try {
        const { store } = await mount(INTEGER, {
            overrides: { valueTypes: { INTEGER: Notes } },
            effects: { required: true },
        })
        const notes = page.getByRole('textbox', { name: 'Age (years)' })
        await expect.element(notes).toBeRequired()
        store.getState().commit(CELL, '5')
        await expect
            .element(notes)
            .toHaveAccessibleDescription('Saved on this device')
        store.getState().commit(CELL, 'abc')
        await expect.element(notes).toHaveAttribute('aria-invalid', 'true')
        await expect
            .element(notes)
            .toHaveAccessibleDescription(/^Saisissez un nombre entier/)
    } finally {
        await i18n.changeLanguage('en')
    }
})

test('an empty date says how to type it', async () => {
    const { cell, store } = await mount({ valueType: 'DATE' })
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Date format: YYYY-MM-DD')
    store.getState().commit(CELL, '2026-10-20')
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Saved on this device')
})

test('a date and time says how to type it too', async () => {
    const { cell } = await mount({ valueType: 'DATETIME' })
    await expect
        .element(cell)
        .toHaveAccessibleDescription('Date format: YYYY-MM-DD HH:mm')
})

test('saved on this device and not saved differ by shape, not only colour', async () => {
    const { cell, store } = await mount(INTEGER)
    const marker = () =>
        inputOf(cell).parentElement?.querySelector('span.size-2') ?? null
    store.getState().commit(CELL, '5')
    await expect.poll(marker).not.toBeNull()
    const saved = getComputedStyle(marker() ?? document.body).borderRadius
    store
        .getState()
        .markSync([{ key: CELL, value: '5' }], 'failed', 'Server said no')
    await expect
        .poll(() => getComputedStyle(marker() ?? document.body).borderRadius)
        .not.toBe(saved)
})
