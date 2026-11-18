import {
    functionalUpdate,
    hasOwn,
    makeStateUpdater,
    stateSlicesEqual,
    type OnChangeFn,
} from '@tanstack/react-table'
import { useRef, useState } from 'react'
import {
    useAppTable,
    type DataTableInstance,
    type DataTableRowData,
    type DataTableState,
} from './tableHook'
import type { DataTableMode } from './types'

type AppTableOptions<TData> = Parameters<
    typeof useAppTable<DataTableRowData<TData>>
>[0]

type ModeOption =
    | 'manualFiltering'
    | 'manualSorting'
    | 'manualPagination'
    | 'pageCount'

export type UseDataTableOptions<TData> = Omit<
    AppTableOptions<TData>,
    ModeOption | 'getRowId'
> & {
    /** A stable id per row, so selection and expansion survive new data. */
    getRowId: NonNullable<AppTableOptions<TData>['getRowId']>
    /**
     * 'client' (default): the table filters, sorts and pages `data`.
     * 'server': `data` is one already-processed page.
     */
    mode?: DataTableMode
}

type QueryKey = 'sorting' | 'columnFilters' | 'globalFilter' | 'pagination'
type QueryState = Partial<Pick<DataTableState, QueryKey>>

const queryKeys = [
    'sorting',
    'columnFilters',
    'globalFilter',
    'pagination',
] as const satisfies readonly QueryKey[]

const sameGlobalFilter = (
    current: DataTableState['globalFilter'],
    next: DataTableState['globalFilter']
): boolean => stateSlicesEqual(current ?? '', next ?? '')

/**
 * Creates the table. In server mode a change of sorting, column filters or
 * the global filter moves to the first page in the same update, so no render
 * pairs the new query with the old page.
 *
 * In server mode without caller atoms, the query slices the caller leaves
 * internal live in React state here: React then commits them together with
 * any slice the caller controls through `state`, even outside event handlers,
 * where a store write would render on its own first.
 */
export const useDataTable = <TData>(
    options: UseDataTableOptions<TData>
): DataTableInstance<TData> => {
    const { mode = 'client', ...tableOptions } = options
    const [owned, setOwned] = useState<QueryState>({})
    const tableRef = useRef<DataTableInstance<TData> | null>(null)

    const getTable = (): DataTableInstance<TData> => {
        if (!tableRef.current) {
            throw new Error('The data table is not ready yet.')
        }
        return tableRef.current
    }

    const server = mode === 'server'
    const callerState = tableOptions.state ?? {}
    const callerAtoms = tableOptions.atoms ?? {}
    const hasCallerAtoms = queryKeys.some(
        (key) => callerAtoms[key] !== undefined
    )
    const callerChange = {
        sorting: tableOptions.onSortingChange,
        columnFilters: tableOptions.onColumnFiltersChange,
        globalFilter: tableOptions.onGlobalFilterChange,
        pagination: tableOptions.onPaginationChange,
    }
    const owns = (key: QueryKey): boolean =>
        server &&
        !hasCallerAtoms &&
        !hasOwn(callerState, key) &&
        callerChange[key] === undefined

    const ownedSetter =
        <TKey extends QueryKey>(key: TKey): OnChangeFn<DataTableState[TKey]> =>
        (updater) =>
            setOwned((previous) => ({
                ...previous,
                [key]: functionalUpdate(
                    updater,
                    previous[key] ?? getTable().initialState[key]
                ),
            }))

    const writer = <TKey extends QueryKey>(
        key: TKey
    ): OnChangeFn<DataTableState[TKey]> =>
        callerChange[key] ??
        (owns(key) ? ownedSetter(key) : makeStateUpdater(key, getTable()))

    const resetting =
        <TKey extends QueryKey>(
            key: TKey,
            isSame: (
                current: DataTableState[TKey],
                next: DataTableState[TKey]
            ) => boolean = stateSlicesEqual
        ): OnChangeFn<DataTableState[TKey]> =>
        (updater) => {
            const table = getTable()
            const current = table.atoms[key].get()
            const changed = !isSame(current, functionalUpdate(updater, current))
            table._reactivity.batch(() => {
                writer(key)(updater)
                if (changed) table.setPageIndex(0)
            })
        }

    const ownedState: QueryState = {}
    for (const key of queryKeys) {
        if (owns(key)) Object.assign(ownedState, { [key]: owned[key] })
    }
    const pagination = owns('pagination')
        ? ownedSetter('pagination')
        : tableOptions.onPaginationChange

    const table = useAppTable<DataTableRowData<TData>>({
        enableSortingRemoval: true,
        sortDescFirst: false,
        columnResizeMode: 'onChange',
        globalFilterFn: 'includesString',
        ...tableOptions,
        defaultColumn: {
            minSize: 64,
            size: 180,
            maxSize: 640,
            filterFn: 'dataTable',
            ...tableOptions.defaultColumn,
        },
        // Always set: the table keeps options from earlier renders, so an
        // omitted `pageCount` would stay -1 after `rowCount` arrives.
        manualFiltering: server,
        manualSorting: server,
        manualPagination: server,
        pageCount:
            server && tableOptions.rowCount === undefined ? -1 : undefined,
        ...(server && {
            state: { ...ownedState, ...callerState },
            onSortingChange: resetting('sorting'),
            onColumnFiltersChange: resetting('columnFilters'),
            onGlobalFilterChange: resetting('globalFilter', sameGlobalFilter),
            ...(pagination && { onPaginationChange: pagination }),
        }),
    })
    tableRef.current = table
    return table
}
