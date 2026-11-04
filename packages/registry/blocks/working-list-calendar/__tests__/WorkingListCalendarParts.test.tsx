import React, { type ReactNode } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { WorkingListResultsError } from '@/components/working-list'
import {
    WorkingListCalendarContext,
    type WorkingListCalendarContextValue,
    type WorkingListCalendarDay,
} from '../WorkingListCalendar'
import { WorkingListCalendarCellRecords } from '../WorkingListCalendarCell'
import { WorkingListCalendarDayRecords } from '../WorkingListCalendarDayRecords'
import { WorkingListCalendarDisplayToggle } from '../WorkingListCalendarDisplayToggle'
import { WorkingListCalendarGrid } from '../WorkingListCalendarGrid'
import { WorkingListCalendarNavigation } from '../WorkingListCalendarNavigation'
import type { WorkingListCalendarStatus } from '../recordStatus'

const ACTIVE = { id: 'ACTIVE', label: 'Active', tone: 'info' as const }
const OVERDUE = { id: 'OVERDUE', label: 'Overdue', tone: 'critical' as const }

const record = (
    id: string,
    date: string,
    status: WorkingListCalendarStatus = ACTIVE
) => ({
    id,
    label: `Person ${id}`,
    date,
    status,
    target: {
        mode: 'trackedEntity' as const,
        programId: 'Program0001',
        trackedEntityId: id,
    },
})

const day = (
    date: string,
    overrides: Partial<WorkingListCalendarDay> = {}
): WorkingListCalendarDay => ({
    date,
    label: Number(date.slice(8)),
    isToday: false,
    isInCurrentMonth: true,
    isDisabled: false,
    records: [],
    ...overrides,
})

// A two-week month starting on a Tuesday, enough to exercise every key.
const weeks = [
    [
        day('2026-10-31', {
            isInCurrentMonth: false,
            records: [record('Z', '2026-10-31')],
        }),
        day('2026-11-01', {
            records: ['A', 'B', 'C', 'D', 'E'].map((id) =>
                record(id, '2026-11-01', id < 'D' ? ACTIVE : OVERDUE)
            ),
        }),
        ...['02', '03', '04', '05'].map((d) => day(`2026-11-${d}`)),
        day('2026-11-06', { records: [record('S', '2026-11-06')] }),
    ],
    [
        ...['07', '08', '09', '10', '11', '12'].map((d) => day(`2026-11-${d}`)),
        day('2026-11-13', { isDisabled: true }),
    ],
]

const renderCalendar = (
    overrides: Partial<WorkingListCalendarContextValue> = {},
    grid: ReactNode = <WorkingListCalendarGrid data-consumer="grid" />
) => {
    const setDisplay = vi.fn()
    const selectDay = vi.fn()
    const onRecordClick = vi.fn()
    const navigateTo = vi.fn()
    const navigateToMonth = vi.fn()
    const navigateToYear = vi.fn()
    const value: WorkingListCalendarContextValue = {
        dateField: 'enrolledAt',
        weeks,
        weekDayLabels: ['M', 'T', 'W', 'T ', 'F', 'S', 'S '],
        navigation: {
            prevMonth: { label: 'October', navigateTo },
            nextMonth: { label: 'December', navigateTo },
            currMonth: { label: 'November' },
            currYear: { label: 2026, value: 2026 },
            months: [
                { value: 10, label: 'October' },
                { value: 11, label: 'November' },
                { value: 12, label: 'December' },
            ],
            years: [
                { value: 2025, label: '2025' },
                { value: 2026, label: '2026' },
            ],
            navigateToMonth,
            navigateToYear,
        },
        visibleMonth: 11,
        selectedDay: null,
        selectDay,
        display: 'records',
        setDisplay,
        dayName: (calendarDay) =>
            `${calendarDay.label} ${calendarDay.date.startsWith('2026-10') ? 'October' : 'November'} 2026`,
        atFilterStart: false,
        atFilterEnd: false,
        results: {
            status: 'ready',
            records: [],
            truncated: false,
            isUpdating: false,
            cellText: () => '',
        },
        onRecordClick,
        ...overrides,
    }
    const tree = (
        <WorkingListCalendarContext.Provider value={value}>
            <WorkingListCalendarNavigation />
            <WorkingListCalendarDisplayToggle />
            {grid}
            <WorkingListCalendarDayRecords />
        </WorkingListCalendarContext.Provider>
    )
    return {
        tree,
        selectDay,
        onRecordClick,
        navigateTo,
        navigateToMonth,
        navigateToYear,
        setDisplay,
    }
}

const dayButton = (container: HTMLElement, date: string) =>
    container.querySelector<HTMLElement>(`[data-date="${date}"]`)

describe('working list calendar parts', () => {
    it('shows the first records of a day and counts the rest', async () => {
        const { tree } = renderCalendar()
        const screen = await render(tree)

        const firstDay = screen.getByRole('button', {
            name: '1 November 2026, 5 records',
        })
        await expect.element(firstDay).toHaveTextContent('Person A')
        await expect.element(firstDay).toHaveTextContent('+2 more')
        await expect.element(firstDay).not.toHaveTextContent('Person D')
        expect(
            screen.container
                .querySelector('[data-slot="working-list-calendar-grid"]')
                ?.getAttribute('data-consumer')
        ).toBe('grid')
    })

    it('selects a day and leaves disabled days alone', async () => {
        const { tree, selectDay } = renderCalendar()
        const screen = await render(tree)

        await screen
            .getByRole('button', { name: '1 November 2026, 5 records' })
            .click()
        expect(selectDay).toHaveBeenCalledWith('2026-11-01')

        const disabledDay = screen.getByRole('button', {
            name: '13 November 2026, no records',
        })
        await expect
            .element(disabledDay)
            .toHaveAttribute('aria-disabled', 'true')
        screen.container
            .querySelector<HTMLElement>('[data-date="2026-11-13"]')
            ?.click()
        expect(selectDay).toHaveBeenCalledTimes(1)
    })

    it('lists every record of the selected day and opens one', async () => {
        const { tree, onRecordClick } = renderCalendar({
            selectedDay: weeks[0][1],
        })
        const screen = await render(tree)

        await expect
            .element(screen.getByRole('heading', { name: '1 November 2026' }))
            .toBeVisible()
        await screen.getByRole('button', { name: 'Person E' }).click()
        expect(onRecordClick).toHaveBeenCalledWith({
            mode: 'trackedEntity',
            programId: 'Program0001',
            trackedEntityId: 'E',
        })
    })

    it('moves focus between days with the arrow keys', async () => {
        const { tree } = renderCalendar()
        const screen = await render(tree)
        const button = (date: string) =>
            screen.container.querySelector<HTMLElement>(`[data-date="${date}"]`)

        expect(button('2026-11-01')?.tabIndex).toBe(0)
        button('2026-11-01')?.focus()
        await userEvent.keyboard('{ArrowDown}')
        expect(document.activeElement).toBe(button('2026-11-08'))
        await userEvent.keyboard('{ArrowRight}')
        expect(document.activeElement).toBe(button('2026-11-09'))
        expect(button('2026-11-09')?.tabIndex).toBe(0)
        await userEvent.keyboard('{ArrowUp}')
        expect(document.activeElement).toBe(button('2026-11-02'))
    })

    it('says when a month holds more records than were loaded', async () => {
        const { tree } = renderCalendar({
            results: {
                status: 'ready',
                records: [],
                truncated: true,
                isUpdating: false,
                cellText: () => '',
            },
        })
        const screen = await render(tree)

        await expect
            .element(screen.getByText(/Showing the first 0 records/))
            .toBeVisible()
    })

    it('offers a retry when records fail to load', async () => {
        const retry = vi.fn()
        const { tree } = renderCalendar({
            results: {
                status: 'error',
                error: new WorkingListResultsError({ message: 'offline' }),
                retry,
            },
        })
        const screen = await render(tree)

        await screen.getByRole('button', { name: 'Try again' }).click()
        expect(retry).toHaveBeenCalled()
    })

    it('stops navigation at the saved filter edges', async () => {
        const { tree, navigateTo } = renderCalendar({ atFilterEnd: true })
        const screen = await render(tree)

        await expect
            .element(screen.getByRole('button', { name: 'Next month' }))
            .toBeDisabled()
        await screen.getByRole('button', { name: 'Previous month' }).click()
        expect(navigateTo).toHaveBeenCalled()
    })

    it('shows neighbouring days with their records', async () => {
        const { tree, selectDay } = renderCalendar()
        const screen = await render(tree)

        const outside = screen.getByRole('button', {
            name: '31 October 2026, 1 record',
        })
        await expect.element(outside).toHaveTextContent('Person Z')
        await outside.click()
        expect(selectDay).toHaveBeenCalledWith('2026-10-31')
    })

    it('jumps to a month or year from the selects', async () => {
        const { tree, navigateToMonth, navigateToYear } = renderCalendar()
        const screen = await render(tree)

        await expect
            .element(screen.getByRole('combobox', { name: 'Month' }))
            .toHaveTextContent('November')
        await screen.getByRole('combobox', { name: 'Month' }).click()
        await screen.getByRole('option', { name: 'December' }).click()
        expect(navigateToMonth).toHaveBeenCalledWith(12)

        await screen.getByRole('combobox', { name: 'Year' }).click()
        await screen.getByRole('option', { name: '2025' }).click()
        expect(navigateToYear).toHaveBeenCalledWith(2025)
    })

    it('counts records by status in the counts display', async () => {
        const { tree } = renderCalendar({ display: 'counts' })
        const screen = await render(tree)

        const firstDay = dayButton(screen.container, '2026-11-01')
        expect(firstDay?.textContent).toContain('3Active')
        expect(firstDay?.textContent).toContain('2Overdue')
        expect(firstDay?.textContent).not.toContain('Person A')
    })

    it('shows as many names as asked', async () => {
        const { tree } = renderCalendar(
            {},
            <WorkingListCalendarGrid>
                <WorkingListCalendarCellRecords max={1} />
            </WorkingListCalendarGrid>
        )
        const screen = await render(tree)

        const text = dayButton(screen.container, '2026-11-01')?.textContent
        expect(text).toContain('Person A')
        expect(text).not.toContain('Person B')
        expect(text).toContain('+4 more')
    })

    it('narrows weekend columns to counts', async () => {
        const { tree } = renderCalendar(
            {},
            <WorkingListCalendarGrid weekend={[6, 7]} weekendColumns="narrow" />
        )
        const screen = await render(tree)

        const sunday = dayButton(screen.container, '2026-11-06')
        expect(sunday?.dataset.weekend).toBe('true')
        expect(sunday?.textContent).not.toContain('Person S')
        expect(sunday?.textContent).toContain('1')
        expect(
            dayButton(screen.container, '2026-11-01')?.textContent
        ).toContain('Person A')
    })

    it('hides weekend columns and says what they hold', async () => {
        const { tree } = renderCalendar(
            {},
            <WorkingListCalendarGrid weekend={[6, 7]} weekendColumns="hide" />
        )
        const screen = await render(tree)

        expect(dayButton(screen.container, '2026-11-05')).toBeNull()
        expect(dayButton(screen.container, '2026-11-06')).toBeNull()
        await expect
            .element(
                screen.getByText('1 record falls on a hidden weekend day.')
            )
            .toBeVisible()
        dayButton(screen.container, '2026-11-01')?.focus()
        await userEvent.keyboard('{ArrowDown}')
        // Five visible columns: down from Tuesday the 1st is Tuesday the 8th.
        expect(document.activeElement).toBe(
            dayButton(screen.container, '2026-11-08')
        )
    })

    it('switches between counts and names from the toggle', async () => {
        const { tree, setDisplay } = renderCalendar({ display: 'counts' })
        const screen = await render(tree)

        await screen.getByRole('button', { name: 'Names' }).click()
        expect(setDisplay).toHaveBeenCalledWith('records')
    })

    it('counts a single record in the singular', async () => {
        const { tree } = renderCalendar({ selectedDay: weeks[0][6] })
        const screen = await render(tree)

        await expect.element(screen.getByText('1 record')).toBeVisible()
    })

    it('lists the selected day with each status', async () => {
        const { tree } = renderCalendar({ selectedDay: weeks[0][1] })
        const screen = await render(tree)

        await expect.element(screen.getByText('5 records')).toBeVisible()
        await expect.element(screen.getByText('Overdue').first()).toBeVisible()
    })

    it('caps status counts and keeps tied groups in one order', async () => {
        const status = (label: string): WorkingListCalendarStatus => ({
            id: label,
            label,
            tone: 'neutral',
        })
        const busy = day('2026-11-01', {
            records: [
                record('A', '2026-11-01', status('Kono')),
                record('B', '2026-11-01', status('Bo')),
                record('C', '2026-11-01', status('Makeni')),
                record('D', '2026-11-01', status('Kenema')),
                record('E', '2026-11-01', status('Kenema')),
            ],
        })
        const { tree } = renderCalendar(
            { display: 'counts', weeks: [[busy]] },
            <WorkingListCalendarGrid>
                <WorkingListCalendarCellRecords max={2} />
            </WorkingListCalendarGrid>
        )
        const screen = await render(tree)

        // Kenema leads with two; Bo beats Kono and Makeni on the tie.
        expect(dayButton(screen.container, '2026-11-01')?.textContent).toBe(
            '12Kenema1Bo+2 more'
        )
    })
})
