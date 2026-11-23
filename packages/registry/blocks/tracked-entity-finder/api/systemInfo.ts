import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { shouldRetryFinderRequest, toRequestError } from './requestErrors'
import { finderKeys, METADATA_CACHE_TIME, type FinderEngine } from './queries'

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

interface FinderServerInfo extends FinderSystemInfo {
    multiTextSearch: boolean
}

const MULTI_TEXT_SEARCH_FROM = 43

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
    .transform((value) =>
        value.toLowerCase().startsWith('dd') ? 'DD-MM-YYYY' : 'YYYY-MM-DD'
    )

const FinderSystemInfoSchema = z
    .object({
        calendar: z.enum(FINDER_CALENDARS),
        dateFormat: DateFormatSchema,
        version: z.string().optional(),
    })
    .transform<FinderServerInfo>(({ calendar, dateFormat, version }) => ({
        calendar,
        dateFormat,
        multiTextSearch: searchesMultiText(version),
    }))

const SYSTEM_INFO_FIELDS = 'calendar,dateFormat,version'

export const systemInfoQueryOptions = (engine: FinderEngine, server: string) =>
    queryOptions({
        queryKey: finderKeys.systemInfo(server),
        queryFn: async ({ signal }) => {
            try {
                const response = await engine.query(
                    {
                        trackedEntityFinderResource: {
                            resource: 'system/info',
                            params: { fields: SYSTEM_INFO_FIELDS },
                        },
                    },
                    { signal }
                )
                return FinderSystemInfoSchema.parse(
                    response.trackedEntityFinderResource
                )
            } catch (cause) {
                throw toRequestError(cause)
            }
        },
        staleTime: METADATA_CACHE_TIME,
        gcTime: METADATA_CACHE_TIME,
        retry: shouldRetryFinderRequest,
    })
