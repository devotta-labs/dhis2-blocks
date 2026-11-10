import { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { parseDateFormat, typedText } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { ValueInput } from '../ValueInput'
import type { ValueInputProps } from '../ValueInput'

const DATE: Field = { valueType: 'DATE' }
const DATETIME: Field = { valueType: 'DATETIME' }
const GREGORIAN: ValueSettings = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}
const ETHIOPIAN: ValueSettings = {
    calendar: parseDhis2Calendar('ethiopian'),
    dateFormat: parseDateFormat('dd-MM-yyyy'),
}
const NEPALI: ValueSettings = {
    calendar: parseDhis2Calendar('nepali'),
    dateFormat: parseDateFormat('yyyy-MM-dd'),
}
const LABEL = 'Date of visit'

const mount = async (props: Partial<ValueInputProps> = {}) => {
    const onChange = vi.fn()
    const base: ValueInputProps = {
        field: DATE,
        settings: GREGORIAN,
        label: LABEL,
        value: undefined,
        onChange,
        ...props,
    }
    const screen = await render(<ValueInput {...base} />)
    return {
        onChange,
        input: page.getByRole('textbox', { name: LABEL }),
        rerender: (more: Partial<ValueInputProps>) =>
            screen.rerender(<ValueInput {...base} {...more} />),
    }
}

const chooser = () => page.getByRole('button', { name: 'Choose date' })
const day = (name: string) => page.getByRole('button', { name, exact: true })
const calendar = () => page.getByRole('grid')

test('a date typed in the system calendar and format is reported as the ISO date', async () => {
    const { input, onChange } = await mount({ settings: ETHIOPIAN })
    await userEvent.click(input)
    await userEvent.keyboard('04-02-2019')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard('{Tab}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-14')
})

test('a date field says how to type it, alongside its description', async () => {
    const { input } = await mount({
        settings: ETHIOPIAN,
        description: 'The day the patient came',
    })
    await expect
        .element(input)
        .toHaveAccessibleDescription(
            'The day the patient came Date format: DD-MM-YYYY'
        )
})

test('a date and time says how to type it too', async () => {
    const { input } = await mount({ field: DATETIME })
    await expect
        .element(input)
        .toHaveAccessibleDescription('Date format: YYYY-MM-DD HH:mm')
})

test('a time is typed, with no calendar to choose from', async () => {
    const { input, onChange } = await mount({ field: { valueType: 'TIME' } })
    await userEvent.click(input)
    await userEvent.keyboard('9:30{Tab}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('09:30')
    await expect.element(chooser()).not.toBeInTheDocument()
})

test('the picker button is named', async () => {
    await mount()
    await expect.element(chooser()).toBeVisible()
})

test('the picker is a dialog named by the month it shows', async () => {
    await mount({ value: '2026-10-14' })
    await userEvent.click(chooser())
    await expect
        .element(page.getByRole('dialog'))
        .toHaveAccessibleName('October 2026')
})

test('the picker opens on the stored day; arrows move days, Page Down a month, Enter picks', async () => {
    const { input, onChange } = await mount({ value: '2026-10-14' })
    await userEvent.click(chooser())
    await expect.element(day('14 October 2026')).toHaveFocus()
    await expect
        .element(page.getByRole('gridcell', { selected: true }))
        .toHaveTextContent('14')
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(day('15 October 2026')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(day('22 October 2026')).toHaveFocus()
    await userEvent.keyboard('{PageDown}')
    await expect.element(day('22 November 2026')).toHaveFocus()
    await userEvent.keyboard('{PageUp}{PageUp}{ArrowLeft}{ArrowUp}')
    await expect.element(day('14 September 2026')).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-09-14')
    await expect.element(calendar()).not.toBeInTheDocument()
    await expect.element(input).toHaveFocus()
    await expect.element(input).toHaveValue('2026-09-14')
    // Leaving the field reports nothing more.
    await userEvent.keyboard('{Tab}')
    expect(onChange).toHaveBeenCalledOnce()
})

test('arrows cross into the next and previous month', async () => {
    // October 2026 starts on a Thursday; June 2026 on a Monday.
    await mount({ value: '2026-10-01' })
    await userEvent.click(chooser())
    await userEvent.keyboard('{ArrowUp}')
    await expect.element(day('24 September 2026')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(day('1 October 2026')).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(day('30 September 2026')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(day('1 October 2026')).toHaveFocus()
})

test('arrows cross out of a month that fills its first and last weeks', async () => {
    // June 2026 runs from a Monday; May 2026 ends on a Sunday.
    await mount({ value: '2026-06-02' })
    await userEvent.click(chooser())
    await userEvent.keyboard('{ArrowUp}')
    await expect.element(day('26 May 2026')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(day('2 June 2026')).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    await expect.element(day('31 May 2026')).toHaveFocus()
})

test('Page Down from the last day of a long month lands on the last day of a short one', async () => {
    await mount({ value: '2026-01-31' })
    await userEvent.click(chooser())
    await userEvent.keyboard('{PageDown}')
    await expect.element(day('28 February 2026')).toHaveFocus()
})

test('Escape closes the picker and returns to the input without reporting', async () => {
    const { input, onChange } = await mount({ value: '2026-10-14' })
    await userEvent.click(chooser())
    await userEvent.keyboard('{ArrowRight}{Escape}')
    await expect.element(calendar()).not.toBeInTheDocument()
    await expect.element(input).toHaveFocus()
    await expect.element(input).toHaveValue('2026-10-14')
    expect(onChange).not.toHaveBeenCalled()
})

test('a click on a day picks it', async () => {
    const { input, onChange } = await mount({ value: '2026-10-14' })
    await userEvent.click(chooser())
    await userEvent.click(day('3 October 2026'))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-03')
    await expect.element(input).toHaveFocus()
})

test('an empty field opens the picker on today', async () => {
    await mount()
    await userEvent.click(chooser())
    await expect
        .poll(() => document.activeElement?.getAttribute('aria-current'))
        .toBe('date')
})

test.each([
    ['Ethiopian', ETHIOPIAN],
    ['Nepali', NEPALI],
])(
    'a day picked in the %s calendar round-trips through the typed input',
    async (_name, settings) => {
        const { input, onChange } = await mount({
            value: '2026-10-14',
            settings,
        })
        await expect
            .element(input)
            .toHaveValue(typedText(DATE, '2026-10-14', settings))
        await userEvent.click(chooser())
        await userEvent.keyboard('{ArrowRight}{Enter}')
        expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-15')
        await expect
            .element(input)
            .toHaveValue(typedText(DATE, '2026-10-15', settings))
        // The text the pick wrote parses back to the day picked: leaving reports nothing new.
        await userEvent.keyboard('{Tab}')
        expect(onChange).toHaveBeenCalledOnce()
    }
)

test('a day picked for a date and time keeps the time typed', async () => {
    const { input, onChange } = await mount({
        field: DATETIME,
        value: '2026-10-14T10:30',
    })
    await userEvent.click(chooser())
    await userEvent.keyboard('{ArrowRight}{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-15T10:30')
    await expect.element(input).toHaveValue('2026-10-15 10:30')
    await expect.element(input).toHaveFocus()
})

test('a day picked for a date and time with no time yet waits for the time', async () => {
    const { input, onChange } = await mount({ field: DATETIME })
    await userEvent.click(chooser())
    await userEvent.keyboard('{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    await expect.element(input).toHaveFocus()
    await userEvent.keyboard('9:15{Tab}')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}T09:15$/)
})

test('a read-only date offers no picker', async () => {
    await mount({ value: '2026-10-14', readOnly: 'Assigned by a rule' })
    await expect.element(chooser()).not.toBeInTheDocument()
})

test('another calendar or date format shows the stored value again, in the new settings', async () => {
    const { input, rerender, onChange } = await mount({ value: '2026-10-14' })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}x')
    await rerender({ settings: { ...GREGORIAN } })
    // The same settings, built anew, keep what is typed.
    await expect.element(input).toHaveValue('2026-10-1x')
    await rerender({ settings: ETHIOPIAN })
    await expect.element(input).toHaveValue('04-02-2019')
    await userEvent.keyboard('{Tab}')
    expect(onChange).not.toHaveBeenCalled()
})

test('a host that keeps the picked value shows it in its calendar', async () => {
    const Host = () => {
        const [value, setValue] = useState<string | undefined>('2026-10-14')
        return (
            <ValueInput
                field={DATE}
                settings={ETHIOPIAN}
                label={LABEL}
                value={value}
                onChange={(next) => setValue(next ?? undefined)}
            />
        )
    }
    await render(<Host />)
    await userEvent.click(chooser())
    await userEvent.keyboard('{ArrowLeft}{Enter}')
    await expect
        .element(page.getByRole('textbox', { name: LABEL }))
        .toHaveValue('03-02-2019')
})

test('right to left, the week runs from the right and Left moves to the next day', async () => {
    await render(
        <div dir="rtl">
            <ValueInput
                field={DATE}
                settings={GREGORIAN}
                label={LABEL}
                value="2026-10-14"
                onChange={() => {}}
            />
        </div>
    )
    await userEvent.click(chooser())
    const left = (name: string) =>
        day(name).element().getBoundingClientRect().left
    expect(left('15 October 2026')).toBeLessThan(left('14 October 2026'))
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(day('15 October 2026')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await expect.element(day('13 October 2026')).toHaveFocus()
})

test('a click elsewhere closes the picker and leaves focus where it was clicked', async () => {
    const onChange = vi.fn()
    await render(
        <>
            <ValueInput
                field={DATE}
                settings={GREGORIAN}
                label={LABEL}
                value="2026-10-14"
                onChange={onChange}
            />
            <input aria-label="Next field" />
        </>
    )
    await userEvent.click(chooser())
    await expect.element(calendar()).toBeVisible()
    const next = page.getByRole('textbox', { name: 'Next field' })
    await userEvent.click(next)
    await expect.element(calendar()).not.toBeInTheDocument()
    await expect.element(next).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
})

test('a read-only date says why, not how to type it', async () => {
    const { input } = await mount({
        value: '2026-10-14',
        readOnly: 'Assigned by a rule',
    })
    await expect
        .element(input)
        .toHaveAccessibleDescription('Assigned by a rule')
})
