import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { z } from 'zod'
import { shouldRetryWorkingListRequest } from '../api/client'
import { fieldsForConfiguration } from '../api/metadata'
import type { WorkingListSystemInfo } from '../api/systemInfo'
import type { WorkingListPagination } from '../domain/model'
import { fetchWorkingListPage, type WorkingListPage } from '../query/fetchers'
import { workingListQueryKeys } from '../query/keys'
import {
    intersectDateBounds,
    requestDateBounds,
    serializeWorkingListRequest,
} from '../query/serialize'
import type {
    WorkingListConfiguration,
    WorkingListDisplayRow,
    WorkingListResultTarget,
} from './contracts'
import { toResultsError } from './errorNormalization'
import type { WorkingListResultsError } from './errors'
import { cellText, toDisplayRows, toResultTargets } from './results'
import { useReferenceFormatting } from './useReferenceFormatting'
import { useWorkingListState } from './WorkingListContext'
import { useWorkingListPrivateUi } from './WorkingListPrivateContext'

const RANGE_PAGE_SIZE = 200

/**
 * A system date the API can bound a request by: `enrolledAt` or
 * `enrollmentOccurredAt` for tracked entities, `eventOccurredAt` or
 * `eventScheduledAt` for events.
 */
export type WorkingListDateFieldId =
    | 'enrolledAt'
    | 'enrollmentOccurredAt'
    | 'eventOccurredAt'
    | 'eventScheduledAt'

export interface WorkingListDateRangeOptions {
    fieldId: WorkingListDateFieldId
    /** First day, inclusive, in the system calendar (YYYY-MM-DD). */
    start: string
    /** Last day, inclusive, in the system calendar (YYYY-MM-DD). */
    end: string
    /** Stops loading once this many records are in. Defaults to 1000. */
    limit?: number
}

export interface WorkingListDateBounds {
    /** The DHIS2 system calendar the list's dates are written in. */
    calendar: WorkingListSystemInfo['calendar']
    /** The DHIS2 server time zone, which decides what today is. */
    timeZone: string
    locale: string
    /** First day the saved filters allow on the field (YYYY-MM-DD). */
    start?: string
    /** Last day the saved filters allow on the field (YYYY-MM-DD). */
    end?: string
}

export interface WorkingListDatedRecord {
    row: WorkingListDisplayRow
    target?: WorkingListResultTarget
    /** The record's date on the field, in the system calendar (YYYY-MM-DD). */
    date: string
}

export type WorkingListDateRangeResults =
    | { status: 'pending' }
    | { status: 'error'; error: WorkingListResultsError; retry(): void }
    | {
          status: 'ready'
          records: readonly WorkingListDatedRecord[]
          /** More records match than `limit` allowed. */
          truncated: boolean
          isUpdating: boolean
          /**
           * Formats a record's field as the table shows it, in plain text:
           * option names, dates in the system calendar, organisation unit
           * names, Yes/No. Unknown fields give an empty string.
           */
          cellText(row: WorkingListDisplayRow, fieldId: string): string
      }

/**
 * Loads up to `limit` records. Once the first page comes back full, every
 * page that can still fit under the limit loads at once.
 */
export const fetchDateRangePages = async (
    fetchPage: (pagination: WorkingListPagination) => Promise<WorkingListPage>,
    limit: number
) => {
    const pageSize = Math.min(RANGE_PAGE_SIZE, limit)
    const first = await fetchPage({ page: 1, pageSize })
    const rest = first.hasNextPage
        ? await Promise.all(
              Array.from({ length: Math.ceil(limit / pageSize) - 1 }, (_, i) =>
                  fetchPage({ page: i + 2, pageSize })
              )
          )
        : []
    const pages = [first, ...rest]
    const loaded = pages.reduce((sum, page) => sum + page.records.length, 0)
    return {
        pages,
        truncated: Boolean(pages.at(-1)?.hasNextPage) || loaded > limit,
    }
}

const datedRecords = (
    pages: readonly WorkingListPage[],
    fieldId: string,
    programId: string,
    configuration: WorkingListConfiguration,
    fromApiDate: (value: string) => string
) =>
    pages.flatMap((pageData) => {
        const targets = toResultTargets({ pageData, programId, configuration })
        return toDisplayRows(pageData).flatMap((row) => {
            const cell = row.values[fieldId]
            const value = cell?.valid
                ? z.string().min(1).safeParse(cell.value)
                : undefined
            if (!value?.success) return []
            return [
                {
                    row,
                    target: targets.get(row.id),
                    date: fromApiDate(value.data),
                },
            ]
        })
    })

/** The list's request and the API dates its saved filters allow on `fieldId`. */
const useDateFieldRequest = (fieldId: WorkingListDateFieldId) => {
    const {
        client,
        programId,
        orgUnitId,
        capabilities,
        metadata,
        resolvedConfiguration,
        serializationContext,
        translate,
    } = useWorkingListPrivateUi()
    return useMemo(() => {
        const toApiDate = serializationContext?.toApiDate
        if (!resolvedConfiguration || !metadata || !toApiDate) return undefined
        const input = {
            client,
            context: { programId, orgUnitId },
            configuration: resolvedConfiguration,
            pagination: { page: 1, pageSize: RANGE_PAGE_SIZE },
            capabilities,
            fields: fieldsForConfiguration(metadata, resolvedConfiguration),
            serializationContext,
            translate,
        }
        return {
            input,
            toApiDate,
            filterBounds: requestDateBounds(
                serializeWorkingListRequest(input),
                fieldId
            ),
        }
    }, [
        capabilities,
        client,
        fieldId,
        metadata,
        orgUnitId,
        programId,
        resolvedConfiguration,
        serializationContext,
        translate,
    ])
}

/**
 * The days the saved filters allow on `fieldId`, and the calendar, time zone
 * and locale to show them in. `undefined` until the list is ready.
 */
export const useWorkingListDateBounds = (
    fieldId: WorkingListDateFieldId
): WorkingListDateBounds | undefined => {
    const { calendarContext, parsingContext } = useWorkingListPrivateUi()
    const request = useDateFieldRequest(fieldId)
    const fromApiDate = parsingContext?.fromApiDate
    return useMemo(() => {
        if (!request || !calendarContext || !fromApiDate) return undefined
        const { start, end } = request.filterBounds
        return {
            calendar: calendarContext.calendar,
            timeZone: calendarContext.timeZone,
            locale: calendarContext.locale,
            start: start === undefined ? undefined : fromApiDate(start),
            end: end === undefined ? undefined : fromApiDate(end),
        }
    }, [calendarContext, fromApiDate, request])
}

/**
 * Reads the current list through a date window instead of a page. The window
 * narrows the saved filters without changing them, so a date layout never
 * dirties the saved view or moves the table's page.
 */
export const useWorkingListDateRange = ({
    fieldId,
    start,
    end,
    limit = 1000,
}: WorkingListDateRangeOptions): WorkingListDateRangeResults => {
    const { client, programId, systemInfo, locale, translate, parsingContext } =
        useWorkingListPrivateUi()
    const configuration = useWorkingListState((state) => state.configuration)
    const request = useDateFieldRequest(fieldId)
    const fromApiDate = parsingContext?.fromApiDate

    const plan = useMemo(() => {
        if (!request) return undefined
        try {
            const range = {
                fieldId,
                start: request.toApiDate(start),
                end: request.toApiDate(end),
            }
            // A window outside the saved filter has nothing to load.
            if (!intersectDateBounds(request.filterBounds, range)) return {}
            const rangeInput = { ...request.input, range }
            return {
                rangeInput,
                queryKey: workingListQueryKeys.recordRequest(
                    serializeWorkingListRequest(rangeInput)
                ),
            }
        } catch (error) {
            // An invalid day, or an event date on a tracked-entity list.
            return { error }
        }
    }, [end, fieldId, request, start])

    const rangeInput = plan?.rangeInput
    const query = useQuery({
        queryKey: [
            ...(plan?.queryKey ?? [...workingListQueryKeys.all, 'records']),
            'date-range',
            rangeInput ? limit : 'idle',
        ],
        queryFn: ({ signal }) => {
            if (!rangeInput) throw new Error('Date range is not ready')
            return fetchDateRangePages(
                (pagination) =>
                    fetchWorkingListPage({ ...rangeInput, pagination, signal }),
                limit
            )
        },
        enabled: Boolean(rangeInput),
        staleTime: 20_000,
        retry: shouldRetryWorkingListRequest,
    })

    const data = rangeInput ? query.data : undefined
    const pages = useMemo(() => data?.pages ?? [], [data])
    const fields = request?.input.fields
    const references = useReferenceFormatting({
        client,
        pages,
        fields,
        systemInfo,
        locale,
        translate,
    })
    const { formattingContext } = references
    const formatCell = useCallback(
        (row: WorkingListDisplayRow, cellFieldId: string) => {
            const field = fields?.get(cellFieldId)
            return field ? cellText(row, field, formattingContext) : ''
        },
        [fields, formattingContext]
    )
    const records = useMemo(
        () =>
            fromApiDate
                ? datedRecords(
                      pages,
                      fieldId,
                      programId,
                      configuration,
                      fromApiDate
                  ).slice(0, limit)
                : [],
        [configuration, fieldId, fromApiDate, limit, pages, programId]
    )

    if (!plan) return { status: 'pending' }
    if (plan.error !== undefined) {
        return {
            status: 'error',
            error: toResultsError(plan.error),
            retry: () => undefined,
        }
    }
    if (!rangeInput) {
        return {
            status: 'ready',
            records: [],
            truncated: false,
            isUpdating: false,
            cellText: formatCell,
        }
    }
    if (query.isError || references.error) {
        return {
            status: 'error',
            error: toResultsError(query.error ?? references.error),
            retry: () =>
                void (query.isError
                    ? query.refetch()
                    : references.organisationUnitLabelsQuery.refetch()),
        }
    }
    if (!data || !references.ready) return { status: 'pending' }
    return {
        status: 'ready',
        records,
        truncated: data.truncated,
        isUpdating: query.isFetching || references.isFetching,
        cellText: formatCell,
    }
}
