import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { workingListQueryKeys } from '../query/keys'
import { shouldRetryWorkingListRequest, type WorkingListClient } from './client'

export const WORKING_LIST_CALENDARS = [
    'coptic',
    'ethiopian',
    'gregorian',
    'islamic',
    'iso8601',
    'nepali',
    'persian',
    'thai',
] as const

export type WorkingListCalendar = (typeof WORKING_LIST_CALENDARS)[number]
export type WorkingListDateFormat = 'YYYY-MM-DD' | 'DD-MM-YYYY'

const DateFormatSchema = z
    .enum([
        'YYYY-MM-DD',
        'DD-MM-YYYY',
        'yyyy-MM-dd',
        'dd-MM-yyyy',
        'yyyy-mm-dd',
        'dd-mm-yyyy',
    ])
    .transform((value): WorkingListDateFormat =>
        value.toLowerCase().startsWith('dd') ? 'DD-MM-YYYY' : 'YYYY-MM-DD'
    )

const TimeZoneSchema = z
    .string()
    .min(1)
    .refine(
        (value) => {
            try {
                new Intl.DateTimeFormat('en', { timeZone: value }).format()
                return true
            } catch {
                return false
            }
        },
        { message: 'serverTimeZoneId is not an IANA time zone' }
    )

export const WorkingListSystemInfoSchema = z
    .object({
        calendar: z.enum(WORKING_LIST_CALENDARS),
        dateFormat: DateFormatSchema,
        serverTimeZoneId: TimeZoneSchema,
    })
    .passthrough()

export type WorkingListSystemInfo = z.infer<typeof WorkingListSystemInfoSchema>

export const WORKING_LIST_SYSTEM_INFO_FIELDS =
    'calendar,dateFormat,serverTimeZoneId'

export const fetchWorkingListSystemInfo = (
    client: WorkingListClient,
    signal?: AbortSignal
) =>
    client.query(
        {
            resource: 'system/info',
            params: { fields: WORKING_LIST_SYSTEM_INFO_FIELDS },
        },
        WorkingListSystemInfoSchema,
        signal
    )

export const workingListSystemInfoQueryOptions = (client: WorkingListClient) =>
    queryOptions({
        queryKey: workingListQueryKeys.systemInfo(),
        queryFn: ({ signal }) => fetchWorkingListSystemInfo(client, signal),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        retry: shouldRetryWorkingListRequest,
    })
