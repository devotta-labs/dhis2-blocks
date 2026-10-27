/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import type { Locator } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { CELL, HEADER, inputOf, rig, withEditor } from '../__tests__/harness'
import { Cell } from '../Cell'
import type { PopupEditor } from '../popupEditors'
import { AgeEditor } from './AgeEditor'

const AGE: Field = { valueType: 'AGE' }
const TODAY = '2026-10-27'
const ETHIOPIAN = { calendar: 'ethiopian', dateFormat: 'DD-MM-YYYY' } as const
const GREGORIAN_DAY_FIRST = {
    calendar: 'gregorian',
    dateFormat: 'DD-MM-YYYY',
} as const
const FUTURE = 'Enter a date of birth that is not in the future'
const WHOLE = 'Enter whole numbers of zero or more'

// Today is fixed, so the ages are too.
const Today: PopupEditor = (props) => <AgeEditor {...props} today={TODAY} />

const mount = async (options?: Parameters<typeof rig>[1]) => {
    withEditor('AGE', Today)
    const setup = rig(AGE, options)
    await render(
        setup.ui(
            <Cell
                cellKey={CELL}
                field={AGE}
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
const birth = dialog.getByRole('textbox', { name: 'Date of birth' })
const years = dialog.getByRole('textbox', { name: 'Years' })
const months = dialog.getByRole('textbox', { name: 'Months' })
const days = dialog.getByRole('textbox', { name: 'Days' })
const save = () => page.getByRole('button', { name: 'Save' })

// F2, not Enter: the Enter right after a save moves on.
const open = async (cell: Locator) => {
    inputOf(cell).focus()
    await userEvent.keyboard('{F2}')
}

test('typing years, months or days fills the date of birth in the system calendar, and back', async () => {
    const { cell, stored } = await mount({ settings: ETHIOPIAN })
    await open(cell)
    await expect.element(birth).toHaveFocus()
    await expect.element(birth).toHaveValue('')
    await expect.element(birth).toHaveAttribute('placeholder', 'DD-MM-YYYY')

    // 2020-10-27, six years back. What is not typed stays empty, and counts as zero.
    await userEvent.fill(years, '6')
    await expect.element(birth).toHaveValue('17-02-2013')
    await expect.element(months).toHaveValue('')
    await expect.element(days).toHaveValue('')
    await userEvent.fill(months, '7')
    await expect.element(birth).toHaveValue('18-07-2012')
    await userEvent.fill(days, '28')
    // 2020-02-29.
    await expect.element(birth).toHaveValue('21-06-2012')
    await userEvent.click(save())
    expect(stored()?.value).toBe('2020-02-29')
    await expect.element(cell).toHaveValue('21-06-2012')

    // A date typed in the system calendar fills the years, months and days.
    await open(cell)
    await expect.element(birth).toHaveValue('21-06-2012')
    await expect.element(years).toHaveValue('6')
    await expect.element(months).toHaveValue('7')
    await expect.element(days).toHaveValue('28')
    // One year before today.
    await userEvent.fill(birth, '17-02-2018')
    await expect.element(years).toHaveValue('1')
    await expect.element(months).toHaveValue('0')
    await expect.element(days).toHaveValue('0')
    await userEvent.fill(birth, '')
    await expect.element(years).toHaveValue('')
    await expect.element(months).toHaveValue('')
    await expect.element(days).toHaveValue('')
})

test('a date of birth in the future is refused with its message', async () => {
    const { cell, stored, enqueued, announced } = await mount({
        value: '2020-02-29',
    })
    await open(cell)
    await userEvent.fill(birth, '2026-10-28')
    // Nothing is said while the date is typed.
    await expect.element(dialog.getByText(FUTURE)).not.toBeInTheDocument()
    await userEvent.click(save())
    await expect.element(dialog.getByText(FUTURE)).toBeVisible()
    await expect.element(birth).toHaveAttribute('aria-invalid', 'true')
    await expect.element(birth).toHaveFocus()
    await expect.element(dialog).toBeVisible()
    expect(enqueued).toEqual([])

    // Typing takes the message away; today is not in the future.
    await userEvent.fill(birth, '2026-10-27')
    await expect.element(dialog.getByText(FUTURE)).not.toBeInTheDocument()
    await expect.element(years).toHaveValue('0')
    await expect.element(months).toHaveValue('0')
    await expect.element(days).toHaveValue('0')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('2026-10-27')

    // Focus leaving with a future date saves nothing and says why.
    await open(cell)
    await userEvent.fill(birth, '2026-10-28')
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('2026-10-27')
    expect(announced).toEqual([FUTURE])

    // A date the calendar does not have is refused with the date message.
    await open(cell)
    await userEvent.fill(birth, '2026-02-30')
    await userEvent.click(save())
    await expect.element(dialog.getByText('Enter a valid date')).toBeVisible()
})

test('negative or fractional parts are refused with "Enter whole numbers of zero or more"', async () => {
    const { cell, stored, enqueued, announced } = await mount()
    await open(cell)
    await userEvent.fill(years, '-1')
    await expect.element(dialog.getByText(WHOLE)).not.toBeInTheDocument()
    await userEvent.click(save())
    await expect.element(dialog.getByText(WHOLE)).toBeVisible()
    await expect.element(years).toHaveAttribute('aria-invalid', 'true')
    await expect.element(years).toHaveFocus()
    expect(enqueued).toEqual([])

    await userEvent.fill(years, '1.5')
    await expect.element(dialog.getByText(WHOLE)).not.toBeInTheDocument()
    await userEvent.click(save())
    await expect.element(dialog.getByText(WHOLE)).toBeVisible()

    // Up to three digits: more would reach back past the calendar.
    await userEvent.fill(years, '1000')
    await userEvent.click(save())
    await expect.element(dialog.getByText(WHOLE)).toBeVisible()
    await userEvent.fill(years, '999')
    await expect.element(dialog.getByText(WHOLE)).not.toBeInTheDocument()
    await expect.element(birth).toHaveValue('1027-10-27')

    // The message is about the part that is wrong, and focus goes to it.
    await userEvent.fill(years, '1')
    await userEvent.fill(months, '2.5')
    await userEvent.click(save())
    await expect.element(months).toHaveAttribute('aria-invalid', 'true')
    await expect.element(years).not.toHaveAttribute('aria-invalid')
    await expect.element(months).toHaveFocus()
    expect(enqueued).toEqual([])

    await userEvent.fill(months, '2')
    await expect.element(birth).toHaveValue('2025-08-27')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('2025-08-27')

    // Focus leaving with a part that is not a whole number saves nothing and says why.
    await open(cell)
    await userEvent.fill(days, '-3')
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('2025-08-27')
    expect(announced).toEqual([WHOLE])
})

test('the editor opens on the stored date of birth and its age; a clear saves no value', async () => {
    const { cell, stored, enqueued } = await mount({
        value: '2020-02-29',
        settings: GREGORIAN_DAY_FIRST,
    })
    await open(cell)
    await expect.element(birth).toHaveValue('29-02-2020')
    await expect.element(years).toHaveValue('6')
    await expect.element(months).toHaveValue('7')
    await expect.element(days).toHaveValue('28')
    await userEvent.fill(years, '1')
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }))
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
    expect(enqueued).toEqual([])

    // Saving what was stored changes nothing.
    await open(cell)
    await userEvent.click(save())
    await expect.element(dialog).not.toBeInTheDocument()
    expect(enqueued).toEqual([])

    await open(cell)
    await userEvent.fill(birth, '')
    await userEvent.click(save())
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBeUndefined()
})

test('leaving the editor saves the date of birth the age last made', async () => {
    const { cell, stored } = await mount()
    await open(cell)
    await userEvent.fill(years, '3')
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBe('2023-10-27')
})

test('a stored date of birth that is not up to today leaves the age empty', async () => {
    const { cell } = await mount({ value: '2027-01-01' })
    await open(cell)
    await expect.element(birth).toHaveValue('2027-01-01')
    await expect.element(years).toHaveValue('')
    await expect.element(months).toHaveValue('')
    await expect.element(days).toHaveValue('')
})

test('retyping an age part leaves the date of birth that was typed, and does not move it to another day', async () => {
    const { cell, stored } = await mount()
    await open(cell)
    // 31 December has no month-end counterpart in September: the age 26 years 9 months 27 days also means the 30th.
    await userEvent.fill(birth, '1999-12-31')
    await expect.element(years).toHaveValue('26')
    await expect.element(months).toHaveValue('9')
    await expect.element(days).toHaveValue('27')
    await userEvent.fill(days, '27')
    await expect.element(birth).toHaveValue('1999-12-31')

    // Typed key by key, the parts pass through other ages and come back to this one.
    await userEvent.fill(days, '')
    await userEvent.keyboard('27')
    await expect.element(days).toHaveValue('27')
    await expect.element(birth).toHaveValue('1999-12-31')

    // Another age is another date, and the first age brings the date back.
    await userEvent.fill(days, '26')
    await expect.element(birth).toHaveValue('2000-01-01')
    await userEvent.fill(days, '27')
    await expect.element(birth).toHaveValue('1999-12-31')
    // Emptying every part is no age, not the age of the date typed.
    await userEvent.fill(years, '')
    await userEvent.fill(months, '')
    await userEvent.fill(days, '')
    await expect.element(birth).toHaveValue('')
    await userEvent.fill(birth, '1999-12-31')
    await userEvent.click(save())
    expect(stored()?.value).toBe('1999-12-31')
})

test('a problem is shown next to the field it is about', async () => {
    const { cell } = await mount()
    const top = (locator: Locator) =>
        locator.element().getBoundingClientRect().top
    const bottom = (locator: Locator) =>
        locator.element().getBoundingClientRect().bottom
    await open(cell)
    await userEvent.fill(birth, '2026-10-28')
    await userEvent.click(save())
    const future = dialog.getByText(FUTURE)
    await expect.element(birth).toHaveAccessibleDescription(FUTURE)
    // Under the date of birth, above the parts.
    expect(top(future)).toBeGreaterThanOrEqual(bottom(birth))
    expect(top(future)).toBeLessThan(top(years))

    await userEvent.fill(birth, '')
    await userEvent.fill(months, '-2')
    await userEvent.click(save())
    const whole = dialog.getByText(WHOLE)
    await expect.element(months).toHaveAccessibleDescription(WHOLE)
    // Under the parts, and not under the date of birth.
    expect(top(whole)).toBeGreaterThanOrEqual(bottom(months))
    await expect.element(birth).not.toHaveAccessibleDescription(WHOLE)
})
