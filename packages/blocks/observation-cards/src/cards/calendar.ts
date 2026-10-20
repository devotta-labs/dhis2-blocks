import { useConfig } from '@dhis2/app-runtime'
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

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

/**
 * A formatter from an ISO date or date-time to `YYYY-MM-DD` in the system
 * calendar. The date part is converted as written, so a reading keeps the day
 * it was recorded on. An unreadable value is returned unchanged.
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
