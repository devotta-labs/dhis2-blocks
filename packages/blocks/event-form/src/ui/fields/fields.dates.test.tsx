import React, { type ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import type { FieldModel } from '../../model/buildFormModel'
import { CalendarInputProvider } from './DateField'
import {
    baseField,
    blur,
    found,
    mountField,
    StubCalendarInput,
    type Commit,
    type MountOptions,
} from './fieldTestSupport'

const mount = (fields: FieldModel | FieldModel[], options?: MountOptions) =>
    mountField(vi.fn<Commit>(), fields, options)

describe('date fields', () => {
    const date = () =>
        page.getByRole('textbox', { name: 'Field one', exact: true })

    it('commits a typed date in ISO format', async () => {
        const { commit } = await mount(baseField({ kind: 'date' }))
        await userEvent.fill(date(), '2026-03-12')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', '2026-03-12')
    })

    it('reads and writes the DD-MM-YYYY display format', async () => {
        const { commit } = await mount(
            baseField({ kind: 'date', value: '2026-03-12' }),
            { calendar: { calendar: 'gregorian', dateFormat: 'DD-MM-YYYY' } }
        )
        await expect.element(date()).toHaveValue('12-03-2026')
        await userEvent.fill(date(), '13-03-2026')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', '2026-03-13')
    })

    it('does not commit a date that does not exist, and says so', async () => {
        const { commit } = await mount(baseField({ kind: 'date' }))
        await userEvent.fill(date(), '2026-02-31')
        await userEvent.tab()
        expect(commit).not.toHaveBeenCalled()
        await expect.element(page.getByText('Enter a valid date')).toBeVisible()
    })

    it('clearing the text commits undefined', async () => {
        const { commit } = await mount(
            baseField({ kind: 'date', value: '2026-03-12' })
        )
        await userEvent.fill(date(), '')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', undefined)
    })

    it('picking a day in the calendar commits it', async () => {
        const { commit } = await mount(
            baseField({ kind: 'date', value: '2026-03-13' })
        )
        await date().click()
        await page.getByText('14', { exact: true }).click()
        expect(commit).toHaveBeenCalledWith('f1', '2026-03-14')
    })

    describe('in the Ethiopian calendar', () => {
        const ethiopian = {
            calendar: 'ethiopian',
            dateFormat: 'YYYY-MM-DD',
        } as const
        const withStub = (children: ReactNode) => (
            <CalendarInputProvider component={StubCalendarInput}>
                {children}
            </CalendarInputProvider>
        )

        it('Ethiopian calendar date commits ISO', async () => {
            const { commit } = await mount(baseField({ kind: 'date' }), {
                calendar: ethiopian,
                wrap: withStub,
            })
            // The calendar is told the Ethiopian calendar, and the picked date is displayed 2018-07-04.
            await expect
                .element(page.getByTestId('stub-calendar'))
                .toHaveTextContent('ethiopic')
            await page.getByRole('button', { name: 'Pick 2018-07-04' }).click()
            expect(commit).toHaveBeenCalledWith('f1', '2026-03-13')
        })

        it('commits the typed Ethiopian date as ISO', async () => {
            const { commit } = await mount(baseField({ kind: 'date' }), {
                calendar: ethiopian,
                wrap: withStub,
            })
            await userEvent.fill(date(), '2018-07-04')
            await userEvent.tab()
            expect(commit).toHaveBeenCalledWith('f1', '2026-03-13')
        })

        it('rejects a day the month does not have', async () => {
            const { commit } = await mount(baseField({ kind: 'date' }), {
                calendar: ethiopian,
                wrap: withStub,
            })
            await userEvent.fill(date(), '2018-13-06')
            await userEvent.tab()
            expect(commit).not.toHaveBeenCalled()
            await expect
                .element(page.getByText('Enter a valid date'))
                .toBeVisible()
        })

        it('shows a stored ISO date in the Ethiopian calendar', async () => {
            await mount(baseField({ kind: 'date', value: '2026-03-13' }), {
                calendar: ethiopian,
                wrap: withStub,
            })
            await expect.element(date()).toHaveValue('2018-07-04')
        })
    })
})

describe('date and time fields', () => {
    const dateInput = () =>
        page.getByRole('textbox', { name: 'Field one', exact: true })
    const timeInput = (container: Element) =>
        page.elementLocator(
            found(container.querySelector('input[type="time"]'))
        )

    it('commits only once both parts are set', async () => {
        const { commit, screen } = await mount(baseField({ kind: 'dateTime' }))
        await userEvent.fill(dateInput(), '2026-03-12')
        await blur()
        expect(commit).not.toHaveBeenCalled()
        await expect.element(page.getByText('Enter a time')).toBeVisible()
        await userEvent.fill(timeInput(screen.container), '14:30')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', '2026-03-12T14:30')
        await expect
            .element(page.getByText('Enter a time'))
            .not.toBeInTheDocument()
    })

    it('names the date when only the time is set', async () => {
        const { commit, screen } = await mount(baseField({ kind: 'dateTime' }))
        await userEvent.fill(timeInput(screen.container), '09:15')
        await blur()
        expect(commit).not.toHaveBeenCalled()
        await expect.element(page.getByText('Enter a date')).toBeVisible()
    })

    it('shows the parts of a stored value and keeps its time when the date changes', async () => {
        const { commit, screen } = await mount(
            baseField({ kind: 'dateTime', value: '2026-03-12T14:30:00.000' })
        )
        await expect.element(dateInput()).toHaveValue('2026-03-12')
        await expect.element(timeInput(screen.container)).toHaveValue('14:30')
        await userEvent.fill(dateInput(), '2026-03-13')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', '2026-03-13T14:30')
    })

    it('clearing a part clears the value and names the missing part', async () => {
        const { commit, screen } = await mount(
            baseField({ kind: 'dateTime', value: '2026-03-12T14:30' })
        )
        await userEvent.clear(timeInput(screen.container))
        expect(commit).toHaveBeenLastCalledWith('f1', undefined)
        await blur()
        await expect.element(page.getByText('Enter a time')).toBeVisible()
    })
})

describe('age fields', () => {
    it('commits the date of birth and shows the age', async () => {
        const { commit } = await mount(
            baseField({ kind: 'age', value: '2020-02-29' })
        )
        await expect
            .element(page.getByText(/^\d+ years, \d+ months, \d+ days$/))
            .toBeVisible()
        const input = page.getByRole('textbox', { name: 'Field one' })
        await userEvent.fill(input, '2021-01-01')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', '2021-01-01')
    })

    it('shows no age without a date', async () => {
        await mount(baseField({ kind: 'age' }))
        await expect
            .element(page.getByText(/years, .* months/))
            .not.toBeInTheDocument()
    })
})
