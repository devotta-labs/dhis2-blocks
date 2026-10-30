/// <reference types="@vitest/browser-playwright" />
import { cdp, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field, Option } from '@/components/dhis2-value-types'
import { CELL, HEADER, inputOf, rig } from './__tests__/harness'
import { Cell } from './Cell'

const LETTERS = 'ABCDEFGHIJKLM'

/** An ICD-sized list: A00, A00.0 … A00.9, A01 …; every name holds an "a". */
const icd = (): Option[] =>
    Array.from({ length: 14_240 }, (_, i) => {
        const group = String(Math.floor((i % 1100) / 11)).padStart(2, '0')
        const sub = i % 11
        const code = `${LETTERS[Math.floor(i / 1100)]}${group}${sub === 0 ? '' : `.${sub - 1}`}`
        return { code, name: `Diagnosis ${code}` }
    })

const ICD: Field = { valueType: 'TEXT', options: icd() }

const mount = async (options?: Parameters<typeof rig>[1], field = ICD) => {
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
    const input = page.getByRole('combobox', { name: 'Age (years)' })
    return { ...setup, input }
}

const list = page.getByRole('listbox')
const options = page.getByRole('option')

test('only the cell being typed in has a list', async () => {
    const { input } = await mount({ value: 'A01' })
    await expect.element(input).toHaveValue('Diagnosis A01')
    await expect.element(input).toHaveAttribute('aria-expanded', 'false')
    inputOf(input).focus()
    await expect.element(list).not.toBeInTheDocument()
    await userEvent.keyboard('I2')
    await expect.element(list).toBeVisible()
    await expect.element(input).toHaveAttribute('aria-expanded', 'true')
    inputOf(input).blur()
    await expect.element(list).not.toBeInTheDocument()
})

test('the picker shows 50 ranked matches and announces the count', async () => {
    const { input, announced } = await mount()
    inputOf(input).focus()
    await userEvent.keyboard('a')
    await expect.element(list).toBeVisible()
    expect(options.all()).toHaveLength(50)
    // Codes starting with what was typed come first.
    await expect.element(options.first()).toHaveTextContent('Diagnosis A00')
    await expect
        .element(options.first())
        .toHaveAttribute('aria-selected', 'true')
    await expect
        .element(input)
        .toHaveAttribute('aria-activedescendant', options.first().element().id)
    await expect
        .element(page.getByText('Showing 50 of 14,240 matches'))
        .toBeVisible()
    // Said once in the grid's live region; the list has none of its own.
    await expect.element(page.getByRole('status')).not.toBeInTheDocument()
    // Typing that leaves the count as it is says nothing more.
    await userEvent.keyboard(' ')
    expect(announced).toEqual(['Showing 50 of 14,240 matches'])
})

test('Enter picks the top match and keeps the flow', async () => {
    const { input, stored, moves } = await mount()
    inputOf(input).focus()
    await userEvent.keyboard('I2')
    const top = inputOf(input).getAttribute('aria-activedescendant')
    await userEvent.keyboard('1')
    // A new top match is a new active option, so a screen reader reads it.
    await expect
        .element(input)
        .not.toHaveAttribute('aria-activedescendant', top)
    await userEvent.keyboard('{Enter}')
    expect(stored()?.value).toBe('I21')
    await expect.element(input).toHaveValue('Diagnosis I21')
    await expect.element(list).not.toBeInTheDocument()
    expect(moves).toEqual([])
    await userEvent.keyboard('{Enter}')
    expect(moves).toEqual(['enter'])
})

test('up and down move through an open list; Enter picks the highlighted match', async () => {
    const { input, stored, moves } = await mount()
    inputOf(input).focus()
    await userEvent.keyboard('I21{ArrowDown}{ArrowDown}{ArrowUp}')
    await expect
        .element(options.nth(1))
        .toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Enter}')
    expect(stored()?.value).toBe('I21.0')
    expect(moves).toEqual([])
})

test('a few matches are listed without a count', async () => {
    const { input } = await mount()
    inputOf(input).focus()
    await userEvent.keyboard('I21')
    expect(options.all()).toHaveLength(11)
    await expect.element(page.getByText(/Showing/)).not.toBeInTheDocument()
})

test('options a rule hid are not offered, drawn or counted', async () => {
    const { input, stored } = await mount({
        effects: { hiddenOptions: new Set(['A00']) },
    })
    inputOf(input).focus()
    await userEvent.keyboard('a')
    expect(options.all()).toHaveLength(50)
    await expect
        .element(
            page.getByRole('option', { name: 'Diagnosis A00', exact: true })
        )
        .not.toBeInTheDocument()
    await expect
        .element(page.getByText('Showing 50 of 14,239 matches'))
        .toBeVisible()
    await userEvent.keyboard('{Enter}')
    expect(stored()?.value).toBe('A00.0')
})

test('typed text that is not an option is refused with its error', async () => {
    const { input, stored, moves, enqueued, announced } = await mount()
    inputOf(input).focus()
    await userEvent.keyboard('zzz')
    await expect.element(list).not.toBeInTheDocument()
    expect(announced).toEqual(['No matches'])
    await userEvent.keyboard('{Enter}')
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect
        .element(input)
        .toHaveAccessibleDescription('Choose one of the options')
    expect(stored()?.draft).toBe('zzz')
    expect(enqueued).toEqual([])
    expect(moves).toEqual([])
})

test('Escape closes the list and keeps the value', async () => {
    const { input, enqueued } = await mount({ value: 'A01' })
    inputOf(input).focus()
    await userEvent.keyboard('I2')
    await expect.element(list).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(list).not.toBeInTheDocument()
    await expect.element(input).toHaveValue('Diagnosis A01')
    expect(enqueued).toEqual([])
})

test('clicking the selected cell lists the options; clicking one picks it', async () => {
    const { input, stored } = await mount()
    inputOf(input).focus()
    await userEvent.click(input)
    await expect.element(list).toBeVisible()
    // Nothing is highlighted, so Enter would not replace the value.
    await expect.element(input).not.toHaveAttribute('aria-activedescendant')
    // Pressing the list anywhere (its scrollbar too) leaves focus in the cell.
    const press = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
    })
    list.element().dispatchEvent(press)
    expect(press.defaultPrevented).toBe(true)
    await userEvent.click(page.getByRole('option', { name: 'Diagnosis A00.1' }))
    expect(stored()?.value).toBe('A00.1')
    await expect.element(list).not.toBeInTheDocument()
    await expect.element(input).toHaveFocus()
})

test('a rule that locks the cell closes its list and keeps focus on the same control', async () => {
    const { input, effects, enqueued } = await mount({ value: 'A01' })
    const control = inputOf(input)
    control.focus()
    await userEvent.keyboard('I2')
    effects.setState({
        cells: {
            [CELL]: {
                required: false,
                messages: [],
                readOnly: 'Assigned by rule: Diagnosis',
            },
        },
    })
    await expect.element(list).not.toBeInTheDocument()
    await expect.element(input).toHaveValue('Diagnosis A01')
    await expect.element(input).toHaveFocus()
    expect(inputOf(input)).toBe(control)
    control.blur()
    expect(enqueued).toEqual([])
})

test('text typed into a cell a rule then hides is saved as the person’s, for the rule to clear', async () => {
    const { input, effects, enqueued } = await mount({ value: 'A01' })
    inputOf(input).focus()
    await userEvent.keyboard('Diagnosis A02')
    effects.setState({
        cells: {
            [CELL]: {
                required: false,
                messages: [],
                hiddenBy: 'Hidden by rule: Not pregnant',
            },
        },
    })
    await expect.element(input).toHaveValue('Hidden')
    inputOf(input).blur()
    expect(enqueued).toEqual([[CELL, 'A02', 'A01']])
})

test('Alt+Down and F4 list every option from the keyboard; Escape closes the list', async () => {
    const { input, stored } = await mount({
        value: 'A01',
        effects: {
            messages: [
                {
                    kind: 'warning',
                    text: 'Check the diagnosis',
                    source: 'rule',
                },
            ],
        },
    })
    inputOf(input).focus()
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    await expect.element(list).toBeVisible()
    expect(options.all()).toHaveLength(50)
    await expect.element(input).not.toHaveAttribute('aria-activedescendant')
    // The cell has notes: Escape closes the list before it would hide them.
    await userEvent.keyboard('{Escape}')
    await expect.element(list).not.toBeInTheDocument()
    await expect.element(page.getByText('Check the diagnosis')).toBeVisible()
    await userEvent.keyboard('{F4}')
    await expect.element(list).toBeVisible()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(stored()?.value).toBe('A00')
})

test('Tab picks the highlighted match and moves; Shift+Tab picks it and leaves the move to the browser', async () => {
    const { input, stored, moves } = await mount()
    inputOf(input).focus()
    await userEvent.keyboard('I21{ArrowDown}{Tab}')
    expect(stored()).toMatchObject({ value: 'I21.0', draft: undefined })
    expect(moves).toEqual(['tab'])
    // Not cancelled: the browser moved focus on.
    await expect.element(input).not.toHaveFocus()
    inputOf(input).focus()
    await userEvent.keyboard('A00{Shift>}{Tab}{/Shift}')
    expect(stored()).toMatchObject({ value: 'A00', draft: undefined })
    expect(moves).toEqual(['tab'])
    await expect.element(input).not.toHaveFocus()
})

const GENDER: Field = {
    valueType: 'TEXT',
    options: [
        { code: 'Male', name: 'Male' },
        { code: 'Female', name: 'Female' },
    ],
}

test.each(['{Delete}', '{Backspace}', ' '])(
    '%s, then Enter, clears the cell: nothing is highlighted to pick',
    async (key) => {
        const { input, stored, moves } = await mount(
            { value: 'Female' },
            GENDER
        )
        inputOf(input).focus()
        await userEvent.keyboard(key)
        await expect.element(list).toBeVisible()
        await expect.element(input).not.toHaveAttribute('aria-activedescendant')
        await userEvent.keyboard('{Enter}')
        expect(stored()).toMatchObject({ value: undefined, sync: 'queued' })
        expect(moves).toEqual(['enter'])
    }
)

test('Tab on emptied text clears the cell too', async () => {
    const { input, stored, moves } = await mount({ value: 'Female' }, GENDER)
    inputOf(input).focus()
    await userEvent.keyboard('{Backspace}{Tab}')
    expect(stored()).toMatchObject({ value: undefined, sync: 'queued' })
    expect(moves).toEqual(['tab'])
})

test('clicking a locked cell lists nothing, even once it is unlocked', async () => {
    const { input, effects } = await mount({
        value: 'A01',
        effects: { readOnly: 'Assigned by rule: Diagnosis' },
    })
    inputOf(input).focus()
    await userEvent.click(input)
    effects.setState({ cells: {} })
    await expect.element(input).not.toHaveAttribute('readonly')
    await expect.element(list).not.toBeInTheDocument()
})

test('first matches in a 14,240-option list within 200 ms, the CPU slowed 4×', async () => {
    // A list no cell has searched yet, so building its index is part of the time.
    const { input } = await mount(undefined, {
        valueType: 'TEXT',
        options: icd(),
    })
    const control = inputOf(input)
    control.focus()
    let pressed = 0
    control.addEventListener(
        'keydown',
        (event) => {
            pressed = event.timeStamp
        },
        { once: true }
    )
    const listed = new Promise<number>((resolve) => {
        const observer = new MutationObserver(() => {
            if (document.querySelector('[role="option"]') !== null) {
                observer.disconnect()
                // The next frame, once the list is painted.
                requestAnimationFrame(() => resolve(performance.now()))
            }
        })
        observer.observe(document.body, { childList: true, subtree: true })
    })
    // A clinic desktop, as the performance budgets measure.
    await cdp().send('Emulation.setCPUThrottlingRate', { rate: 4 })
    try {
        await userEvent.keyboard('a')
        expect((await listed) - pressed).toBeLessThan(200)
    } finally {
        await cdp().send('Emulation.setCPUThrottlingRate', { rate: 1 })
    }
})
