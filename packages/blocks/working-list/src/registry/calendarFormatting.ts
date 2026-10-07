import type {
    WorkingListCalendar,
    WorkingListSystemInfo,
} from '../api/systemInfo'

/** Official Unicode calendar identifiers for DHIS2 calendars supported by Intl. */
export const INTL_CALENDAR_BY_DHIS2 = {
    coptic: 'coptic',
    ethiopian: 'ethiopic',
    gregorian: 'gregory',
    islamic: 'islamic',
    iso8601: 'gregory',
    nepali: undefined,
    persian: 'persian',
    thai: 'buddhist',
} satisfies Record<WorkingListCalendar, string | undefined>

export const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

export const localDateString = (
    date: { year: number; eraYear?: number; month: number; day: number },
    systemInfo: WorkingListSystemInfo,
    format = systemInfo.dateFormat
) => {
    const year =
        systemInfo.calendar === 'ethiopian'
            ? (date.eraYear ?? date.year)
            : date.year

    const isoOrder = `${pad(year, 4)}-${pad(date.month)}-${pad(date.day)}`

    return format === 'DD-MM-YYYY'
        ? `${pad(date.day)}-${pad(date.month)}-${pad(year, 4)}`
        : isoOrder
}

export interface CalendarDateParts {
    year: number
    month: number
    day: number
}

export const parseClientDate = (value: string): CalendarDateParts => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

    if (!match) {
        throw new Error(`Invalid client date: ${value}`)
    }

    const [, year, month, day] = match.map(Number)

    return { year, month, day }
}
