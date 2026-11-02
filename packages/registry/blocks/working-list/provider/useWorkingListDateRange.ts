import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { z } from 'zod'
import { shouldRetryWorkingListRequest } from '../api/client'
import { fieldsForConfiguration } from '../api/metadata'
import { fetchWorkingListPage, type WorkingListPage } from '../query/fetchers'
import { workingListQueryKeys } from '../query/keys'
import {
    intersectDateBounds,
    requestDateBounds,
    serializeWorkingListRequest,
    type DateBounds,
} from '../query/serialize'
import type {
    WorkingListConfiguration,
    WorkingListDisplayRow,
    WorkingListResultTarget,
} from './contracts'
import { toResultsError } from './errorNormalization'
import type { WorkingListResultsError } from './errors'
import { toDisplayRows, toResultTargets } from './results'
import { useWorkingListState } from './WorkingListContext'
import { useWorkingListPrivateUi } from './WorkingListPrivateContext'

const RANGE_PAGE_SIZE = 200

export interface WorkingListDateRangeOptions {
    /**
     * The system date field to read: `enrolledAt` or `enrollmentOccurredAt`
     * for tracked entities, `eventOccurredAt` or `eventScheduledAt` for events.
     */
    fieldId: string
    /** First day, inclusive, in the system calendar (YYYY-MM-DD). */
    start: string
    /** Last day, inclusive, in the system calendar (YYYY-MM-DD). */
    end: string
    /** Stops loading once this many records are in. Defaults to 1000. */
    limit?: number
}

export interface WorkingListDatedRecord {
    row: WorkingListDisplayRow
    target?: WorkingListResultTarget
    /** The record's date on the field, in the system calendar (YYYY-MM-DD). */
    date: string
}

export type WorkingListDateRangeResults = {
    /** The days the saved filters allow on the field, in the system calendar. */
    filterBounds: DateBounds
} & (
    | { status: 'pending' }
    | { status: 'error'; error: WorkingListResultsError; retry(): void }
    | {
          status: 'ready'
          records: readonly WorkingListDatedRecord[]
          /** More records match than `limit` allowed. */
          truncated: boolean
          isUpdating: boolean
      }
)

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
    const {
        client,
        programId,
        orgUnitId,
        capabilities,
        metadata,
        resolvedConfiguration,
        serializationContext,
        parsingContext,
        translate,
    } = useWorkingListPrivateUi()
    const configuration = useWorkingListState((state) => state.configuration)
    const toApiDate = serializationContext?.toApiDate
    const fromApiDate = parsingContext?.fromApiDate

    const plan = useMemo(() => {
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
        const filterBounds = requestDateBounds(
            serializeWorkingListRequest(input),
            fieldId
        )
        const range = { fieldId, start: toApiDate(start), end: toApiDate(end) }
        const rangeInput = intersectDateBounds(filterBounds, range)
            ? { ...input, range }
            : undefined
        return {
            filterBounds,
            rangeInput,
            queryKey: rangeInput
                ? workingListQueryKeys.recordRequest(
                      serializeWorkingListRequest(rangeInput)
                  )
                : undefined,
        }
    }, [
        capabilities,
        client,
        end,
        fieldId,
        metadata,
        orgUnitId,
        programId,
        resolvedConfiguration,
        serializationContext,
        start,
        toApiDate,
        translate,
    ])

    const rangeInput = plan?.rangeInput
    const query = useQuery({
        queryKey: [
            ...(plan?.queryKey ?? [...workingListQueryKeys.all, 'records']),
            'date-range',
            rangeInput ? limit : 'idle',
        ],
        queryFn: async ({ signal }) => {
            if (!rangeInput) throw new Error('Date range is not ready')
            const pages: WorkingListPage[] = []
            let loaded = 0
            let hasNextPage = true
            while (hasNextPage && loaded < limit) {
                const page = await fetchWorkingListPage({
                    ...rangeInput,
                    pagination: {
                        page: pages.length + 1,
                        pageSize: Math.min(RANGE_PAGE_SIZE, limit),
                    },
                    signal,
                })
                pages.push(page)
                loaded += page.records.length
                hasNextPage = page.hasNextPage
            }
            return { pages, truncated: hasNextPage || loaded > limit }
        },
        enabled: Boolean(rangeInput),
        placeholderData: keepPreviousData,
        staleTime: 20_000,
        retry: shouldRetryWorkingListRequest,
    })

    const data = rangeInput ? query.data : undefined
    const records = useMemo(
        () =>
            data && fromApiDate
                ? datedRecords(
                      data.pages,
                      fieldId,
                      programId,
                      configuration,
                      fromApiDate
                  ).slice(0, limit)
                : [],
        [configuration, data, fieldId, fromApiDate, limit, programId]
    )
    const filterBounds = useMemo(
        () => ({
            start:
                plan?.filterBounds.start && fromApiDate
                    ? fromApiDate(plan.filterBounds.start)
                    : undefined,
            end:
                plan?.filterBounds.end && fromApiDate
                    ? fromApiDate(plan.filterBounds.end)
                    : undefined,
        }),
        [fromApiDate, plan]
    )

    if (!plan) return { filterBounds, status: 'pending' }
    // A window outside the saved filter has nothing to load.
    if (!rangeInput) {
        return {
            filterBounds,
            status: 'ready',
            records: [],
            truncated: false,
            isUpdating: false,
        }
    }
    if (query.isError) {
        return {
            filterBounds,
            status: 'error',
            error: toResultsError(query.error),
            retry: () => void query.refetch(),
        }
    }
    if (!data) return { filterBounds, status: 'pending' }
    return {
        filterBounds,
        status: 'ready',
        records,
        truncated: data.truncated,
        isUpdating: query.isFetching,
    }
}
