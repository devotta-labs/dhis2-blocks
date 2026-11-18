import {
    useDataTable,
    type DataTableInstance,
    type DataTableStatus,
    type UseDataTableOptions,
} from '@/components/data-table'
import {
    functionalUpdate,
    type ColumnFiltersState,
    type OnChangeFn,
    type PaginationState,
    type SortingState,
} from '@tanstack/react-table'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toPatientListFilterQuery, type PatientListFilter } from './filters'
import type {
    PatientListFilterQuery,
    PatientListOrgUnitMode,
    PatientListQuery,
    PatientListRow,
} from './types'
import { usePatientListQuery } from './usePatientListQuery'

export const PATIENT_LIST_PAGE_SIZES = [10, 15, 25, 50, 100] as const

export interface UsePatientListOptions extends Omit<
    UseDataTableOptions<PatientListRow>,
    'data' | 'mode' | 'getRowId' | 'rowCount'
> {
    program: string
    orgUnit: string
    orgUnitMode?: PatientListOrgUnitMode
    filters?: readonly PatientListFilter[]
    /** Query parts sent with every request, before the user's filters. */
    baseQuery?: PatientListFilterQuery
    /** Order used while the table has no sorting. Default ['createdAt:desc']. */
    defaultOrder?: readonly string[]
    /** Default true. */
    enabled?: boolean
}

export interface PatientListController {
    table: DataTableInstance<PatientListRow>
    filters: readonly PatientListFilter[]
    status: DataTableStatus
    error: Error | null
    hasNextPage: boolean
    refetch: () => void
    /** The query for the page being shown. */
    query: PatientListQuery
}

const EMPTY_ROWS: PatientListRow[] = []
const NO_FILTERS: readonly PatientListFilter[] = []
const NO_SORTING: SortingState = []
const NO_COLUMN_FILTERS: ColumnFiltersState = []
const DEFAULT_ORDER: readonly string[] = ['createdAt:desc']
const DEFAULT_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 15 }

const getRowId = (row: PatientListRow) => row.trackedEntity

interface QuerySlice<T> {
    value: T
    onChange: OnChangeFn<T> | undefined
    controlled: boolean
}

/**
 * A query slice the caller controls through `state`, or one this hook keeps
 * in React state, so the query can be built before the table exists.
 */
const useQuerySlice = <T>(
    callerValue: T | undefined,
    callerChange: OnChangeFn<T> | undefined,
    initial: T
): QuerySlice<T> => {
    const [own, setOwn] = useState(initial)
    const ownChange = useCallback<OnChangeFn<T>>(
        (updater) => setOwn((old) => functionalUpdate(updater, old)),
        []
    )
    return callerValue === undefined
        ? { value: own, onChange: ownChange, controlled: false }
        : { value: callerValue, onChange: callerChange, controlled: true }
}

const toOrder = (
    sorting: SortingState,
    defaultOrder: readonly string[]
): readonly string[] =>
    sorting.length > 0
        ? sorting.map(({ id, desc }) => `${id}:${desc ? 'desc' : 'asc'}`)
        : defaultOrder

/**
 * The tracked entities of one program and organisation unit, one page per
 * request, in a server-mode data table.
 */
export const usePatientList = (
    options: UsePatientListOptions
): PatientListController => {
    const {
        program,
        orgUnit,
        orgUnitMode,
        filters = NO_FILTERS,
        baseQuery,
        defaultOrder = DEFAULT_ORDER,
        enabled = true,
        state,
        initialState,
        onSortingChange,
        onColumnFiltersChange,
        onPaginationChange,
        ...rest
    } = options
    const initialPagination = initialState?.pagination ?? DEFAULT_PAGINATION

    const sorting = useQuerySlice(
        state?.sorting,
        onSortingChange,
        initialState?.sorting ?? NO_SORTING
    )
    const columnFilters = useQuerySlice(
        state?.columnFilters,
        onColumnFiltersChange,
        initialState?.columnFilters ?? NO_COLUMN_FILTERS
    )
    const pagination = useQuerySlice(
        state?.pagination,
        onPaginationChange,
        initialPagination
    )

    // A new program or organisation unit starts on the first page. An owned
    // page index is reset during render, so no request pairs the new scope
    // with the old page.
    const [scope, setScope] = useState({ program, orgUnit })
    if (scope.program !== program || scope.orgUnit !== orgUnit) {
        setScope({ program, orgUnit })
        if (!pagination.controlled && pagination.value.pageIndex !== 0) {
            pagination.onChange?.((old) => ({ ...old, pageIndex: 0 }))
        }
    }

    const { pageIndex, pageSize } = pagination.value
    const query = useMemo(
        (): PatientListQuery => ({
            program,
            orgUnit,
            orgUnitMode,
            page: pageIndex + 1,
            pageSize,
            order: toOrder(sorting.value, defaultOrder),
            ...toPatientListFilterQuery(
                filters,
                columnFilters.value,
                baseQuery
            ),
        }),
        [
            program,
            orgUnit,
            orgUnitMode,
            pageIndex,
            pageSize,
            sorting.value,
            defaultOrder,
            filters,
            columnFilters.value,
            baseQuery,
        ]
    )

    const result = usePatientListQuery(query, { enabled })
    const page = result.data

    const table = useDataTable<PatientListRow>({
        ...rest,
        initialState: { ...initialState, pagination: initialPagination },
        mode: 'server',
        data: page?.rows ?? EMPTY_ROWS,
        getRowId,
        state: {
            ...state,
            sorting: sorting.value,
            columnFilters: columnFilters.value,
            pagination: pagination.value,
        },
        onSortingChange: sorting.onChange,
        onColumnFiltersChange: columnFilters.onChange,
        onPaginationChange: pagination.onChange,
    })

    // The selection and a page the caller controls follow after the commit.
    // Compared with the last scope, not "after the first run", so StrictMode's
    // second mount resets nothing. Only a new scope runs it; the other values
    // are read from the render that changed it.
    const resetScope = useRef(scope)
    useEffect(() => {
        if (resetScope.current === scope) return
        resetScope.current = scope
        table.resetRowSelection(true)
        if (pagination.controlled && pagination.value.pageIndex !== 0) {
            pagination.onChange?.({
                pageIndex: 0,
                pageSize: pagination.value.pageSize,
            })
        }
    }, [scope])

    const { refetch: refetchQuery } = result
    const refetch = useCallback(() => {
        void refetchQuery()
    }, [refetchQuery])

    const status = ((): DataTableStatus => {
        if (page === undefined) {
            if (result.isError) return 'error'
            return result.isPending && enabled ? 'loading' : 'ready'
        }
        return result.isFetching && result.isPlaceholderData
            ? 'updating'
            : 'ready'
    })()

    return {
        table,
        filters,
        status,
        error: result.error,
        hasNextPage: page?.hasNextPage ?? false,
        refetch,
        query,
    }
}
