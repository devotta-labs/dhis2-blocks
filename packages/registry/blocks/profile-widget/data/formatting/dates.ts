import { convertFromIso8601 } from '@dhis2/multi-calendar-dates'
import type { ProfileCalendar, ProfileSystemInfo } from '../../api/schemas'

type MultiCalendarIdentifier = Parameters<typeof convertFromIso8601>[1]

interface CalendarDate {
    year: number
    month: number
    day: number
}

const MULTI_CALENDAR_IDENTIFIERS = {
    coptic: 'coptic',
    ethiopian: 'ethiopic',
    gregorian: 'gregory',
    islamic: 'islamic',
    iso8601: 'iso8601',
    nepali: 'nepali',
    persian: 'persian',
    thai: 'buddhist',
} satisfies Record<ProfileCalendar, MultiCalendarIdentifier>

const EPAGOMENAL_EPOCHS = {
    coptic: 1825030,
    ethiopian: 1724221,
} as const

type EpagomenalCalendar = keyof typeof EPAGOMENAL_EPOCHS

const isEpagomenalCalendar = (
    calendar: ProfileCalendar
): calendar is EpagomenalCalendar =>
    calendar === 'coptic' || calendar === 'ethiopian'

const gregorianToJulianDay = ({ year, month, day }: CalendarDate) => {
    const offset = Math.floor((14 - month) / 12)
    const adjustedYear = year + 4800 - offset
    const adjustedMonth = month + 12 * offset - 3
    return (
        day +
        Math.floor((153 * adjustedMonth + 2) / 5) +
        365 * adjustedYear +
        Math.floor(adjustedYear / 4) -
        Math.floor(adjustedYear / 100) +
        Math.floor(adjustedYear / 400) -
        32045
    )
}

const epagomenalToJulianDay = (
    date: CalendarDate,
    calendar: EpagomenalCalendar
) =>
    EPAGOMENAL_EPOCHS[calendar] -
    1 +
    365 * (date.year - 1) +
    Math.floor(date.year / 4) +
    30 * (date.month - 1) +
    date.day

const julianDayToEpagomenal = (
    julianDay: number,
    calendar: EpagomenalCalendar
): CalendarDate => {
    const epoch = EPAGOMENAL_EPOCHS[calendar]
    let year = Math.floor((4 * (julianDay - epoch) + 1463) / 1461)
    while (
        julianDay < epagomenalToJulianDay({ year, month: 1, day: 1 }, calendar)
    ) {
        year -= 1
    }
    while (
        julianDay >=
        epagomenalToJulianDay({ year: year + 1, month: 1, day: 1 }, calendar)
    ) {
        year += 1
    }
    const dayOfYear =
        julianDay - epagomenalToJulianDay({ year, month: 1, day: 1 }, calendar)
    return {
        year,
        month: Math.floor(dayOfYear / 30) + 1,
        day: (dayOfYear % 30) + 1,
    }
}

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

const isoDateString = ({ year, month, day }: CalendarDate) =>
    `${pad(year, 4)}-${pad(month)}-${pad(day)}`

const isValidGregorianDate = ({ year, month, day }: CalendarDate) => {
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    )
}

const toSystemCalendarDate = (
    isoDate: CalendarDate,
    calendar: ProfileCalendar
): CalendarDate => {
    if (isEpagomenalCalendar(calendar)) {
        return julianDayToEpagomenal(gregorianToJulianDay(isoDate), calendar)
    }
    const converted = convertFromIso8601(
        isoDateString(isoDate),
        MULTI_CALENDAR_IDENTIFIERS[calendar]
    )
    return {
        year: converted.eraYear ?? converted.year,
        month: converted.month,
        day: converted.day,
    }
}

interface ServerDateTime {
    date: CalendarDate
    hours: number
    minutes: number
}

const SERVER_DATE_TIME =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/

const parseServerDateTime = (value: string): ServerDateTime | undefined => {
    const match = SERVER_DATE_TIME.exec(value.trim())
    if (!match) {
        return undefined
    }
    const [, year, month, day, hours = '0', minutes = '0', zone] = match
    if (zone !== undefined) {
        const instant = new Date(value.trim())
        if (Number.isNaN(instant.getTime())) {
            return undefined
        }
        return {
            date: {
                year: instant.getFullYear(),
                month: instant.getMonth() + 1,
                day: instant.getDate(),
            },
            hours: instant.getHours(),
            minutes: instant.getMinutes(),
        }
    }
    const date = { year: Number(year), month: Number(month), day: Number(day) }
    if (!isValidGregorianDate(date)) {
        return undefined
    }
    return { date, hours: Number(hours), minutes: Number(minutes) }
}

const formatLocalDate = (
    date: CalendarDate,
    dateFormat: ProfileSystemInfo['dateFormat']
) =>
    dateFormat === 'DD-MM-YYYY'
        ? `${pad(date.day)}-${pad(date.month)}-${pad(date.year, 4)}`
        : `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}`

const formatParsedDate = (
    parsed: ServerDateTime,
    systemInfo: ProfileSystemInfo
): string | undefined => {
    try {
        return formatLocalDate(
            toSystemCalendarDate(parsed.date, systemInfo.calendar),
            systemInfo.dateFormat
        )
    } catch {
        return undefined
    }
}

export const formatServerDate = (
    value: string,
    systemInfo: ProfileSystemInfo
): string | undefined => {
    const parsed = parseServerDateTime(value)
    return parsed ? formatParsedDate(parsed, systemInfo) : undefined
}

export const formatServerDateTime = (
    value: string,
    systemInfo: ProfileSystemInfo
): string | undefined => {
    const parsed = parseServerDateTime(value)
    const date = parsed ? formatParsedDate(parsed, systemInfo) : undefined
    return parsed && date
        ? `${date} ${pad(parsed.hours)}:${pad(parsed.minutes)}`
        : undefined
}
