import {
    convertFromIso8601,
    convertToIso8601,
    getNowInCalendar,
    validateDateString,
} from '@dhis2/multi-calendar-dates'
import type {
    WorkingListCalendar,
    WorkingListSystemInfo,
} from '../api/systemInfo'
import type {
    Dhis2ValueType,
    RelativeDatePeriod,
    WorkingListField,
} from '../domain/model'
import { getValueTypeDefinition } from './valueTypes'
import type {
    CellFormattingContext,
    FilterParsingContext,
    FilterSerializationContext,
    WorkingListRawValue,
} from './valueTypes'

type MultiCalendarIdentifier = Parameters<typeof convertFromIso8601>[1]

const DATE_VALUE_TYPES = new Set<Dhis2ValueType>(['AGE', 'DATE', 'DATETIME'])

/** Official Unicode calendar identifiers for DHIS2 calendars supported by Intl. */
const INTL_CALENDAR_BY_DHIS2 = {
    coptic: 'coptic',
    ethiopian: 'ethiopic',
    gregorian: 'gregory',
    islamic: 'islamic',
    iso8601: 'gregory',
    nepali: undefined,
    persian: 'persian',
    thai: 'buddhist',
} satisfies Record<WorkingListCalendar, string | undefined>

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

const localDateString = (
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

interface CalendarDateParts {
    year: number
    month: number
    day: number
}

const parseClientDate = (value: string): CalendarDateParts => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) {
        throw new Error(`Invalid client date: ${value}`)
    }
    const [, year, month, day] = match.map(Number)
    return { year, month, day }
}

/**
 * Normalises DHIS2's server calendar names to the identifiers understood by
 * `@dhis2/multi-calendar-dates` and Temporal.
 */
export const toMultiCalendarIdentifier = (
    calendar: WorkingListSystemInfo['calendar']
): MultiCalendarIdentifier =>
    (
        ({
            coptic: 'coptic',
            ethiopian: 'ethiopic',
            gregorian: 'gregory',
            islamic: 'islamic',
            iso8601: 'iso8601',
            nepali: 'nepali',
            persian: 'persian',
            thai: 'buddhist',
        }) satisfies Record<WorkingListCalendar, MultiCalendarIdentifier>
    )[calendar]

const clientDateString = ({ year, month, day }: CalendarDateParts) =>
    `${pad(year, 4)}-${pad(month)}-${pad(day)}`

const isEpagomenalCalendar = (
    calendar: WorkingListSystemInfo['calendar']
): calendar is 'coptic' | 'ethiopian' =>
    calendar === 'coptic' || calendar === 'ethiopian'

const isEpagomenalLeapYear = (year: number) => year % 4 === 3

const isValidEpagomenalDate = ({
    year,
    month,
    day,
}: CalendarDateParts): boolean => {
    const epagomenalDays = isEpagomenalLeapYear(year) ? 6 : 5
    const daysInMonth = month <= 12 ? 30 : epagomenalDays

    return (
        year > 0 && month >= 1 && month <= 13 && day >= 1 && day <= daysInMonth
    )
}

/**
 * Validates the editor's canonical YYYY-MM-DD value in the server calendar.
 * The DHIS2 converter constrains overflowing dates, so validating before
 * conversion is essential: 2025-02-31 must never silently become February 28.
 */
export const isValidWorkingListClientDate = (
    value: string,
    systemInfo: Pick<WorkingListSystemInfo, 'calendar'>
) => {
    let parts: CalendarDateParts
    try {
        parts = parseClientDate(value)
    } catch {
        return false
    }
    if (isEpagomenalCalendar(systemInfo.calendar)) {
        return isValidEpagomenalDate(parts)
    }
    return validateDateString(value, {
        calendar: toMultiCalendarIdentifier(systemInfo.calendar),
        strictValidation: true,
    }).valid
}

const assertValidClientDate = (
    value: string,
    systemInfo: Pick<WorkingListSystemInfo, 'calendar'>
) => {
    if (!isValidWorkingListClientDate(value, systemInfo)) {
        throw new Error(
            `Invalid ${systemInfo.calendar} calendar date: ${value}`
        )
    }
}

const gregorianToJulianDay = ({ year, month, day }: CalendarDateParts) => {
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

const julianDayToGregorian = (julianDay: number): CalendarDateParts => {
    const offset = julianDay + 32044
    const century = Math.floor((4 * offset + 3) / 146097)
    const dayOfCentury = offset - Math.floor((146097 * century) / 4)
    const yearOfCentury = Math.floor((4 * dayOfCentury + 3) / 1461)
    const dayOfYear = dayOfCentury - Math.floor((1461 * yearOfCentury) / 4)
    const monthIndex = Math.floor((5 * dayOfYear + 2) / 153)
    return {
        day: dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1,
        month: monthIndex + 3 - 12 * Math.floor(monthIndex / 10),
        year:
            100 * century + yearOfCentury - 4800 + Math.floor(monthIndex / 10),
    }
}

const EPAGOMENAL_EPOCHS = {
    coptic: 1825030,
    ethiopian: 1724221,
} as const

const epagomenalToJulianDay = (
    date: CalendarDateParts,
    calendar: keyof typeof EPAGOMENAL_EPOCHS
) =>
    EPAGOMENAL_EPOCHS[calendar] -
    1 +
    365 * (date.year - 1) +
    Math.floor(date.year / 4) +
    30 * (date.month - 1) +
    date.day

const julianDayToEpagomenal = (
    julianDay: number,
    calendar: keyof typeof EPAGOMENAL_EPOCHS
): CalendarDateParts => {
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
    const month = Math.floor(dayOfYear / 30) + 1
    return { year, month, day: (dayOfYear % 30) + 1 }
}

const convertClientDateToIso = (
    parts: CalendarDateParts,
    calendar: WorkingListSystemInfo['calendar']
) => {
    if (isEpagomenalCalendar(calendar)) {
        return julianDayToGregorian(epagomenalToJulianDay(parts, calendar))
    }
    const converted = convertToIso8601(
        clientDateString(parts),
        toMultiCalendarIdentifier(calendar)
    )
    return { year: converted.year, month: converted.month, day: converted.day }
}

const convertIsoDateToClient = (
    parts: CalendarDateParts,
    calendar: WorkingListSystemInfo['calendar']
) => {
    if (isEpagomenalCalendar(calendar)) {
        return julianDayToEpagomenal(gregorianToJulianDay(parts), calendar)
    }
    const converted = convertFromIso8601(
        clientDateString(parts),
        toMultiCalendarIdentifier(calendar)
    )
    return {
        year: converted.eraYear ?? converted.year,
        month: converted.month,
        day: converted.day,
    }
}

export interface WorkingListTransformerOptions {
    systemInfo: WorkingListSystemInfo
    locale?: string
    trueLabel?: string
    falseLabel?: string
    resolveDisplayName?: (id: string) => string | undefined
    resolveFileResourceName?: (id: string) => string | undefined
    /** ISO date override for deterministic serialization and tests. */
    today?: string
    /** Sunday is 0. Defaults to Capture's Sunday-first fallback. */
    firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export interface WorkingListValueTransformers {
    systemInfo: WorkingListSystemInfo
    /** Server ISO date to local-calendar editor value (always YYYY-MM-DD). */
    serverToClient(value: string, valueType: Dhis2ValueType): string
    /** Server ISO date to configured list/view format. */
    serverToView(value: string, valueType: Dhis2ValueType): string
    clientToServer(value: string, valueType: Dhis2ValueType): string
    isValidClientDate(value: string): boolean
    formatListValue(value: WorkingListRawValue, field: WorkingListField): string
    resolveRelativeDate(value: {
        period?: RelativeDatePeriod
        startBuffer?: number
        endBuffer?: number
    }): { start?: string; end?: string }
    serializationContext: FilterSerializationContext
    parsingContext: FilterParsingContext
    formattingContext: CellFormattingContext
}

export const createWorkingListValueTransformers = (
    options: WorkingListTransformerOptions
): WorkingListValueTransformers => {
    const { systemInfo } = options

    const serverToClient = (value: string, valueType: Dhis2ValueType) => {
        if (!DATE_VALUE_TYPES.has(valueType)) {
            return value
        }
        const isoDate = value.slice(0, 10)
        if (
            !isValidWorkingListClientDate(isoDate, {
                calendar: 'gregorian',
            })
        ) {
            throw new Error(`Invalid server date: ${value}`)
        }
        const local = localDateString(
            convertIsoDateToClient(
                parseClientDate(isoDate),
                systemInfo.calendar
            ),
            systemInfo,
            'YYYY-MM-DD'
        )
        if (valueType !== 'DATETIME') {
            return local
        }
        const time = value.match(/[T ](\d{2}:\d{2}(?::\d{2})?)/)?.[1]
        return time ? `${local} ${time}` : local
    }

    const serverToView = (value: string, valueType: Dhis2ValueType) => {
        if (!DATE_VALUE_TYPES.has(valueType)) {
            return value
        }
        const clientValue = serverToClient(value, valueType)
        const [datePart, timePart] = clientValue.split(' ', 2)
        const intlCalendar = INTL_CALENDAR_BY_DHIS2[systemInfo.calendar]
        if (intlCalendar) {
            const { year, month, day } = parseClientDate(value.slice(0, 10))
            const time =
                valueType === 'DATETIME' && timePart
                    ? timePart.padEnd(8, ':00')
                    : '12:00:00'
            const lexicalServerValue = new Date(
                Date.UTC(
                    Number(year),
                    Number(month) - 1,
                    Number(day),
                    Number(time.slice(0, 2)),
                    Number(time.slice(3, 5)),
                    Number(time.slice(6, 8))
                )
            )
            try {
                const formatOptions: Intl.DateTimeFormatOptions = {
                    calendar: intlCalendar,
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    // Tracker values are calendar-local. Constructing the
                    // original ISO lexical fields in UTC preserves their date
                    // and time instead of applying a host-zone or offset shift.
                    timeZone: 'UTC',
                }
                if (valueType === 'DATETIME' && timePart) {
                    formatOptions.hour = 'numeric'
                    formatOptions.minute = '2-digit'
                    formatOptions.second = '2-digit'
                }
                const formatter = new Intl.DateTimeFormat(
                    options.locale,
                    formatOptions
                )
                if (formatter.resolvedOptions().calendar === intlCalendar) {
                    return formatter.format(lexicalServerValue)
                }
            } catch {
                // Older runtimes can reject a valid Unicode calendar. The
                // validated DHIS2 client-format fallback below remains safe.
            }
        }
        const [year, month, day] = datePart.split('-').map(Number)
        const formatted = localDateString({ year, month, day }, systemInfo)
        return valueType === 'DATETIME' && timePart
            ? `${formatted} ${timePart}`
            : formatted
    }

    const clientToServer = (value: string, valueType: Dhis2ValueType) => {
        if (!DATE_VALUE_TYPES.has(valueType)) {
            return value
        }
        const [datePart, timePart] = value.trim().split(/[T ]/, 2)
        assertValidClientDate(datePart, systemInfo)
        const normalizedLocalDate = parseClientDate(datePart)
        const converted = convertClientDateToIso(
            normalizedLocalDate,
            systemInfo.calendar
        )
        const isoDate = `${pad(converted.year, 4)}-${pad(converted.month)}-${pad(converted.day)}`
        const roundTrip = convertIsoDateToClient(converted, systemInfo.calendar)
        if (
            clientDateString(roundTrip) !==
            clientDateString(normalizedLocalDate)
        ) {
            throw new Error(
                `Date conversion changed ${datePart} to ${clientDateString(roundTrip)}`
            )
        }
        return valueType === 'DATETIME' && timePart
            ? `${isoDate}T${timePart}`
            : isoDate
    }

    const isoToday = () => {
        if (options.today) {
            if (
                !isValidWorkingListClientDate(options.today, {
                    calendar: 'gregorian',
                })
            ) {
                throw new Error(`Invalid today override: ${options.today}`)
            }
            return options.today
        }
        const now = getNowInCalendar('iso8601', systemInfo.serverTimeZoneId)
        return `${pad(now.year, 4)}-${pad(now.month)}-${pad(now.day)}`
    }

    const localToday = () =>
        convertIsoDateToClient(parseClientDate(isoToday()), systemInfo.calendar)

    const localToIso = (date: CalendarDateParts) => {
        assertValidClientDate(clientDateString(date), systemInfo)
        const converted = convertClientDateToIso(date, systemInfo.calendar)
        return `${pad(converted.year, 4)}-${pad(converted.month)}-${pad(converted.day)}`
    }

    const addIsoDays = (value: string, days: number) => {
        const date = new Date(`${value}T12:00:00Z`)
        date.setUTCDate(date.getUTCDate() + days)
        return date.toISOString().slice(0, 10)
    }

    const monthsInYear = () =>
        isEpagomenalCalendar(systemInfo.calendar) ? 13 : 12

    const monthBefore = (date: CalendarDateParts): CalendarDateParts =>
        date.month === 1
            ? { year: date.year - 1, month: monthsInYear(), day: 1 }
            : { year: date.year, month: date.month - 1, day: 1 }

    const lastDayOfMonth = (date: CalendarDateParts) => {
        for (let day = 32; day >= 1; day -= 1) {
            const candidate = { ...date, day }
            if (
                isValidWorkingListClientDate(
                    clientDateString(candidate),
                    systemInfo
                )
            ) {
                return candidate
            }
        }
        throw new Error(
            `Could not resolve ${systemInfo.calendar} month ${date.year}-${date.month}`
        )
    }

    const resolveRelativeDate: WorkingListValueTransformers['resolveRelativeDate'] =
        (value) => {
            const today = localToday()
            const todayIso = isoToday()
            if (
                value.startBuffer !== undefined ||
                value.endBuffer !== undefined
            ) {
                if (
                    value.startBuffer === undefined ||
                    value.endBuffer === undefined ||
                    value.startBuffer > 0 ||
                    value.endBuffer < 0
                ) {
                    throw new Error(
                        'Relative buffers require a non-positive start and non-negative end'
                    )
                }
                return {
                    start: addIsoDays(todayIso, value.startBuffer),
                    end: addIsoDays(todayIso, value.endBuffer),
                }
            }

            const startOfMonth = (date: CalendarDateParts) => ({
                ...date,
                day: 1,
            })
            const endOfMonth = (date: CalendarDateParts) =>
                lastDayOfMonth(startOfMonth(date))
            const firstDayOfWeek = options.firstDayOfWeek ?? 0
            const calendarWeekDay = new Date(
                `${todayIso}T12:00:00Z`
            ).getUTCDay()
            const daysSinceWeekStart =
                (calendarWeekDay - firstDayOfWeek + 7) % 7

            let start: string
            let end: string
            switch (value.period) {
                case 'TODAY':
                    start = todayIso
                    end = todayIso
                    break
                case 'THIS_WEEK':
                    start = addIsoDays(todayIso, -daysSinceWeekStart)
                    end = addIsoDays(start, 6)
                    break
                case 'LAST_WEEK':
                    start = addIsoDays(todayIso, -daysSinceWeekStart - 7)
                    end = addIsoDays(start, 6)
                    break
                case 'THIS_MONTH':
                    start = localToIso(startOfMonth(today))
                    end = localToIso(endOfMonth(today))
                    break
                case 'LAST_MONTH': {
                    const month = monthBefore(today)
                    start = localToIso(startOfMonth(month))
                    end = localToIso(endOfMonth(month))
                    break
                }
                case 'LAST_3_MONTHS': {
                    const previous = monthBefore(today)
                    const first = monthBefore(monthBefore(previous))
                    start = localToIso(startOfMonth(first))
                    end = localToIso(endOfMonth(previous))
                    break
                }
                case 'THIS_YEAR':
                    start = localToIso({ year: today.year, month: 1, day: 1 })
                    end = localToIso(
                        lastDayOfMonth({
                            year: today.year,
                            month: monthsInYear(),
                            day: 1,
                        })
                    )
                    break
                default:
                    throw new Error(
                        `Unsupported relative date period: ${value.period}`
                    )
            }
            return { start, end }
        }

    const formatDate = (value: string, valueType: Dhis2ValueType) =>
        serverToView(value, valueType)

    const formattingContext: CellFormattingContext = {
        locale: options.locale,
        trueLabel: options.trueLabel,
        falseLabel: options.falseLabel,
        resolveDisplayName: options.resolveDisplayName,
        resolveFileResourceName: options.resolveFileResourceName,
        formatDate,
        formatNumber: (value) =>
            new Intl.NumberFormat(options.locale).format(value),
    }
    const serializationContext: FilterSerializationContext = {
        today: isoToday(),
        toApiDate: (value) => clientToServer(value, 'DATE'),
        validateDate: (value) => assertValidClientDate(value, systemInfo),
        resolveRelativeDate,
    }
    const parsingContext: FilterParsingContext = {
        fromApiDate: (value) => serverToClient(value, 'DATE'),
    }

    return {
        systemInfo,
        serverToClient,
        serverToView,
        clientToServer,
        isValidClientDate: (value) =>
            isValidWorkingListClientDate(value, systemInfo),
        formatListValue: (value, field) =>
            getValueTypeDefinition(field.valueType).format(
                value,
                field,
                formattingContext
            ),
        resolveRelativeDate,
        serializationContext,
        parsingContext,
        formattingContext,
    }
}
