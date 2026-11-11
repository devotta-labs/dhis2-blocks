import { z } from 'zod'

const FINDER_CALENDARS = [
    'coptic',
    'ethiopian',
    'gregorian',
    'islamic',
    'iso8601',
    'nepali',
    'persian',
    'thai',
] as const

export type FinderCalendar = (typeof FINDER_CALENDARS)[number]
export type FinderDateFormat = 'YYYY-MM-DD' | 'DD-MM-YYYY'

/** The server calendar and date format the date inputs follow. */
export interface FinderSystemInfo {
    calendar: FinderCalendar
    dateFormat: FinderDateFormat
}

/** The system info the finder reads: its calendar, and what search allows. */
export interface FinderServerInfo extends FinderSystemInfo {
    /**
     * Whether the server matches each code of a MULTI_TEXT value (DHIS2 2.43
     * and later). Older servers compare the whole stored list.
     */
    multiTextSearch: boolean
}

const MULTI_TEXT_SEARCH_FROM = 43

/** Reads `2.43.1`, `2.43-SNAPSHOT` or `43.0`; anything else is too old. */
const searchesMultiText = (version?: string) => {
    const [major = NaN, minor = NaN] = (version ?? '').split(/[.-]/).map(Number)
    const release = major === 2 ? minor : major
    return Number.isInteger(release) && release >= MULTI_TEXT_SEARCH_FROM
}

const DateFormatSchema = z
    .enum([
        'YYYY-MM-DD',
        'DD-MM-YYYY',
        'yyyy-MM-dd',
        'dd-MM-yyyy',
        'yyyy-mm-dd',
        'dd-mm-yyyy',
    ])
    .transform((value): FinderDateFormat =>
        value.toLowerCase().startsWith('dd') ? 'DD-MM-YYYY' : 'YYYY-MM-DD'
    )

export const FinderSystemInfoSchema = z
    .object({
        calendar: z.enum(FINDER_CALENDARS),
        dateFormat: DateFormatSchema,
        version: z.string().optional(),
    })
    .transform(({ calendar, dateFormat, version }): FinderServerInfo => ({
        calendar,
        dateFormat,
        multiTextSearch: searchesMultiText(version),
    }))
