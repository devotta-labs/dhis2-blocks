import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import {
    Calendar,
    CalendarProvider,
    CalendarNavigation,
    CalendarDisplayToggle,
    CalendarGrid,
    CalendarDayRecords,
    useCalendar,
    useCalendarState,
    type CalendarDisplay,
    type CalendarRecord,
} from '..'

const records: CalendarRecord[] = [
    {
        id: 'launch',
        date: '2026-11-14',
        label: 'Product launch',
        status: { id: 'planned', label: 'Planned', tone: 'info' },
    },
    { id: 'review', date: '2026-11-14', label: 'Design review' },
    {
        id: 'private',
        date: '2026-11-14',
        label: 'Private task',
        disabled: true,
    },
]

const Parts = () => (
    <>
        <CalendarNavigation />
        <CalendarDisplayToggle />
        <CalendarGrid />
        <CalendarDayRecords />
    </>
)

const Range = () => {
    const { visibleRange } = useCalendar()
    return (
        <output aria-label="Visible range">
            {visibleRange.start} / {visibleRange.end}
        </output>
    )
}

describe('standalone calendar', () => {
    it('shows an empty month even when the supplied dataset contains other months', async () => {
        const screen = await render(
            <Calendar records={records} defaultSelectedDay="2026-11-14">
                <Parts />
            </Calendar>
        )
        await screen.getByRole('button', { name: 'Next month' }).click()
        await expect
            .element(screen.getByText('No records this month.'))
            .toBeVisible()
    })

    it('shows arbitrary records without providers, deduplicates and opens a record', async () => {
        const onRecordClick = vi.fn()
        const screen = await render(
            <Calendar
                records={[...records, records[0]]}
                defaultSelectedDay="2026-11-14"
                defaultDisplay="records"
                onRecordClick={onRecordClick}
                data-consumer="calendar"
            >
                <Parts />
                <Range />
            </Calendar>
        )
        await expect
            .element(
                screen.getByRole('button', {
                    name: '14 November 2026, 3 records',
                })
            )
            .toHaveTextContent('Product launch')
        await screen
            .getByRole('button', { name: 'Product launch', exact: true })
            .click()
        expect(onRecordClick).toHaveBeenCalledWith(records[0])
        await expect
            .element(
                screen.getByRole('button', {
                    name: 'Private task',
                    exact: true,
                })
            )
            .not.toBeInTheDocument()
        await expect
            .element(screen.getByLabelText('Visible range'))
            .toHaveTextContent('2026-10-26 / 2026-12-06')
        expect(
            screen.container
                .querySelector('[data-slot="calendar"]')
                ?.getAttribute('data-consumer')
        ).toBe('calendar')
    })

    it('supports controlled selection and display, including clearing without changing month', async () => {
        const Controlled = () => {
            const [selectedDay, setSelectedDay] = useState<string | null>(
                '2026-11-14'
            )
            const [display, setDisplay] = useState<CalendarDisplay>('counts')
            return (
                <>
                    <button onClick={() => setSelectedDay(null)}>
                        Clear selection
                    </button>
                    <output aria-label="Selected date">
                        {selectedDay ?? 'none'}
                    </output>
                    <Calendar
                        records={records}
                        selectedDay={selectedDay}
                        onSelectedDayChange={setSelectedDay}
                        display={display}
                        onDisplayChange={setDisplay}
                    >
                        <Parts />
                    </Calendar>
                </>
            )
        }
        const screen = await render(<Controlled />)
        const day = screen.getByRole('button', {
            name: '14 November 2026, 3 records',
        })
        await expect.element(day).not.toHaveTextContent('Product launch')
        await screen.getByRole('button', { name: 'Names', exact: true }).click()
        await expect.element(day).toHaveTextContent('Product launch')
        await screen
            .getByRole('button', { name: '15 November 2026, no records' })
            .click()
        await expect
            .element(screen.getByLabelText('Selected date'))
            .toHaveTextContent('2026-11-15')
        await screen.getByRole('button', { name: 'Clear selection' }).click()
        await expect
            .element(screen.getByLabelText('Selected date'))
            .toHaveTextContent('none')
        await expect
            .element(screen.getByRole('combobox', { name: 'Month' }))
            .toHaveTextContent('November')
        await expect
            .element(screen.getByText('Select a day to see its records.'))
            .toBeVisible()
    })

    it('opens within date bounds and disables days outside them', async () => {
        const screen = await render(
            <Calendar start="2025-03-10" end="2025-03-20">
                <Parts />
            </Calendar>
        )
        await expect
            .element(screen.getByRole('combobox', { name: 'Month' }))
            .toHaveTextContent('March')
        await expect
            .element(screen.getByRole('button', { name: 'Previous month' }))
            .toBeDisabled()
        await expect
            .element(screen.getByRole('button', { name: 'Next month' }))
            .toBeDisabled()
        await expect
            .element(
                screen.getByRole('button', {
                    name: '9 March 2025, no records',
                    exact: true,
                })
            )
            .toHaveAttribute('aria-disabled', 'true')
        await screen
            .getByRole('button', { name: '10 March 2025, no records' })
            .click()
        await expect
            .element(screen.getByRole('heading', { name: '10 March 2025' }))
            .toBeVisible()
    })

    it('lets a data adapter query the visible weeks synchronously', async () => {
        const ranges = vi.fn()
        const RemoteCalendar = () => {
            const state = useCalendarState({ defaultSelectedDay: '2026-11-14' })
            ranges(state.visibleRange)
            return (
                <CalendarProvider
                    state={state}
                    results={
                        state.visibleMonth === 11
                            ? { status: 'ready', records }
                            : { status: 'pending' }
                    }
                >
                    <Parts />
                </CalendarProvider>
            )
        }
        const screen = await render(<RemoteCalendar />)
        expect(ranges).toHaveBeenLastCalledWith({
            start: '2026-10-26',
            end: '2026-12-06',
        })
        await screen.getByRole('button', { name: 'Next month' }).click()
        expect(ranges).toHaveBeenLastCalledWith({
            start: '2026-11-30',
            end: '2027-01-03',
        })
        await expect.element(screen.getByText('Loading records…')).toBeVisible()
        await expect
            .element(screen.getByRole('grid'))
            .toHaveAttribute('aria-busy', 'true')
        await expect
            .element(screen.getByText('Product launch', { exact: true }))
            .not.toBeInTheDocument()
    })

    it.each([
        ['gregorian', '2026-11-14'],
        ['ethiopian', '2018-13-03'],
        ['nepali', '2083-07-28'],
    ] as const)('places records in the %s calendar', async (calendar, date) => {
        const screen = await render(
            <Calendar
                calendar={calendar}
                defaultSelectedDay={date}
                records={[{ id: 'project', date, label: 'Milestone' }]}
                defaultDisplay="records"
            >
                <Parts />
            </Calendar>
        )
        expect(
            screen.container.querySelector(`[data-date="${date}"]`)?.textContent
        ).toContain('Milestone')
        await expect
            .element(screen.getByText('1 record', { exact: true }))
            .toBeVisible()
    })

    it('handles unsupported Coptic dates without mounting the picker', async () => {
        const screen = await render(
            <Calendar calendar="coptic">
                <Parts />
            </Calendar>
        )
        await expect
            .element(screen.getByText(/does not support the Coptic calendar/))
            .toBeVisible()
        expect(screen.container.querySelector('table')).toBeNull()
    })
})
