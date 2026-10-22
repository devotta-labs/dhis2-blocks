import { useConfig } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { convertFromIso8601 } from '@dhis2/multi-calendar-dates'
import { useCallback } from 'react'
import { z } from 'zod'

type MultiCalendarIdentifier = Parameters<typeof convertFromIso8601>[1]

const CALENDARS = [
    'coptic',
    'ethiopian',
    'gregorian',
    'islamic',
    'iso8601',
    'nepali',
    'persian',
    'thai',
] as const

type Dhis2Calendar = (typeof CALENDARS)[number]

const SystemInfoCalendarSchema = z.object({ calendar: z.enum(CALENDARS) })

/**
 * Normalises DHIS2's server calendar names to the identifiers understood by
 * `@dhis2/multi-calendar-dates`. Copied from Working List, which this package
 * does not import.
 */
const toMultiCalendarIdentifier = (
    calendar: Dhis2Calendar
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
        }) satisfies Record<Dhis2Calendar, MultiCalendarIdentifier>
    )[calendar]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

/**
 * The user's DHIS2 locale as a tag `Intl` accepts. DHIS2 uses underscores
 * (`fr_SN`), which `Intl` rejects; one it still can't read falls back to the
 * browser's locale.
 */
export const intlLocale = (): string | undefined => {
    try {
        return Intl.getCanonicalLocales(i18n.language?.replace(/_/g, '-'))[0]
    } catch {
        return undefined
    }
}

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

/** Calendars `Intl` can name months for, so dates read as "14 Oct 2026". */
const INTL_CALENDARS = new Set<Dhis2Calendar>(['gregorian', 'iso8601'])

/**
 * A formatter from an ISO date or date-time to a date in the system calendar:
 * a short, locale-ordered date such as "14 Oct 2026" for the Gregorian
 * calendar, and `YYYY-MM-DD` for the others, whose month names `Intl` lacks.
 * The date part is converted as written, so a reading keeps the day it was
 * recorded on. An unreadable value is returned unchanged.
 */
export const useFormatDate = (): ((iso: string) => string) => {
    const { systemInfo } = useConfig()
    const parsed = SystemInfoCalendarSchema.safeParse(systemInfo)
    const calendar = parsed.success ? parsed.data.calendar : 'gregorian'

    return useCallback(
        (iso: string) => {
            const day = ISO_DATE.exec(iso)?.[0]
            if (day === undefined) {
                return iso
            }
            if (INTL_CALENDARS.has(calendar)) {
                const date = new Date(`${day}T00:00:00Z`)
                return Number.isNaN(date.getTime())
                    ? day
                    : new Intl.DateTimeFormat(intlLocale(), {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'UTC',
                      }).format(date)
            }
            try {
                const converted = convertFromIso8601(
                    day,
                    toMultiCalendarIdentifier(calendar)
                )
                const year = converted.eraYear ?? converted.year
                return `${pad(year, 4)}-${pad(converted.month)}-${pad(converted.day)}`
            } catch {
                return day
            }
        },
        [calendar]
    )
}
