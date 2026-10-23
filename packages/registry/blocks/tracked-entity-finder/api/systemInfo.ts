import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { shouldRetryFinderRequest, type FinderResourceClient } from './client'
import { finderKeys } from './queries'

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

const FinderSystemInfoSchema = z
    .object({
        calendar: z.enum(FINDER_CALENDARS),
        dateFormat: DateFormatSchema,
    })
    .passthrough()

const SYSTEM_INFO_FIELDS = 'calendar,dateFormat'

export const systemInfoQueryOptions = (client: FinderResourceClient) =>
    queryOptions({
        queryKey: finderKeys.systemInfo(),
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'system/info',
                    params: { fields: SYSTEM_INFO_FIELDS },
                },
                FinderSystemInfoSchema,
                signal
            ),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        retry: shouldRetryFinderRequest,
    })
