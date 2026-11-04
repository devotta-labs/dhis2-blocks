import { useDatePicker } from '@dhis2/multi-calendar-dates'
import React from 'react'
import { render } from 'vitest-browser-react'
import { createWorkingListValueTransformers } from '@/components/working-list/registry/transformers'
import { PICKER_CALENDARS } from '../WorkingListCalendar'

const MonthDays = ({
    calendar,
    date,
}: {
    calendar: keyof typeof PICKER_CALENDARS
    date: string
}) => {
    const picker = useDatePicker({
        date,
        options: {
            calendar: PICKER_CALENDARS[calendar],
            timeZone: 'UTC',
            locale: 'en',
        },
        onDateSelect: () => undefined,
    })
    return (
        <ul>
            {picker.calendarWeekDays.flat().map((day) => (
                <li
                    key={day.dateValue}
                    data-date={day.dateValue}
                    data-in-month={day.isInCurrentMonth}
                />
            ))}
        </ul>
    )
}

// Records are placed by the working list's date conversion and the grid by
// the date picker's; a record lands on a day only when the two agree.
describe('the calendar grid and the working list agree on days', () => {
    it.each([
        ['gregorian', '2026-11-14'],
        ['ethiopian', '2026-11-14'],
        // Pagume, the Ethiopian thirteenth month.
        ['ethiopian', '2026-09-08'],
        ['nepali', '2026-11-14'],
    ] as const)('%s for %s', async (calendar, isoDate) => {
        const { parsingContext } = createWorkingListValueTransformers({
            systemInfo: {
                calendar,
                dateFormat: 'YYYY-MM-DD',
                serverTimeZoneId: 'UTC',
            },
            today: '2026-11-02',
        })
        const day = parsingContext.fromApiDate?.(isoDate)
        if (!day) throw new Error('fromApiDate is missing')

        const screen = await render(
            <MonthDays calendar={calendar} date={day} />
        )

        const cell = screen.container.querySelector(`[data-date="${day}"]`)
        expect(cell?.getAttribute('data-in-month')).toBe('true')
    })
})
