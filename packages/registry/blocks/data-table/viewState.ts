import type { SortingState } from '@tanstack/react-table'
import { z } from 'zod'
import {
    dataTableFilterValueSchema,
    parseDataTableFilterValue,
} from './filters/filterValue'
import type { DataTableFilterValue } from './filters/types'
import type { DataTableInstance, DataTableState } from './tableHook'

/**
 * The parts of the table state a user would save as a view. Row selection,
 * expansion and the page index are never part of it.
 */
export interface DataTableViewState {
    version: 1
    sorting?: SortingState
    columnFilters?: { id: string; value: DataTableFilterValue }[]
    globalFilter?: string
    columnVisibility?: Record<string, boolean>
    columnOrder?: string[]
    columnPinning?: { start?: string[]; end?: string[] }
    columnSizing?: Record<string, number>
    grouping?: string[]
    pageSize?: number
}

const ids = z.array(z.string())

export const dataTableViewStateSchema = z.object({
    version: z.literal(1),
    sorting: z
        .array(z.object({ id: z.string(), desc: z.boolean() }))
        .optional(),
    columnFilters: z
        .array(z.object({ id: z.string(), value: dataTableFilterValueSchema }))
        .optional(),
    globalFilter: z.string().optional(),
    columnVisibility: z.record(z.string(), z.boolean()).optional(),
    columnOrder: ids.optional(),
    columnPinning: z
        .object({ start: ids.optional(), end: ids.optional() })
        .optional(),
    columnSizing: z.record(z.string(), z.number()).optional(),
    grouping: ids.optional(),
    pageSize: z.number().int().positive().optional(),
}) satisfies z.ZodType<DataTableViewState>

const searchText = z.string()

const nonEmpty = <T>(items: T[]): T[] | undefined =>
    items.length > 0 ? items : undefined

const nonEmptyRecord = <T>(
    record: Record<string, T>
): Record<string, T> | undefined =>
    Object.keys(record).length > 0 ? record : undefined

/** The current view, without empty slices or filter values it cannot read. */
export const getDataTableViewState = <TData>(
    table: DataTableInstance<TData>
): DataTableViewState => {
    const state = table.store.state
    const sorting = nonEmpty(state.sorting)
    const columnFilters = nonEmpty(
        state.columnFilters.flatMap((entry) => {
            const value = parseDataTableFilterValue(entry)
            return value === undefined ? [] : [{ id: entry.id, value }]
        })
    )
    const search = searchText.safeParse(state.globalFilter)
    const globalFilter =
        search.success && search.data !== '' ? search.data : undefined
    const columnVisibility = nonEmptyRecord(state.columnVisibility)
    const columnOrder = nonEmpty(state.columnOrder)
    const pinStart = nonEmpty(state.columnPinning.start)
    const pinEnd = nonEmpty(state.columnPinning.end)
    const columnSizing = nonEmptyRecord(state.columnSizing)
    const grouping = nonEmpty(state.grouping)
    const { pageSize } = state.pagination
    return {
        version: 1,
        ...(sorting && { sorting }),
        ...(columnFilters && { columnFilters }),
        ...(globalFilter !== undefined && { globalFilter }),
        ...(columnVisibility && { columnVisibility }),
        ...(columnOrder && { columnOrder }),
        ...((pinStart || pinEnd) && {
            columnPinning: {
                ...(pinStart && { start: pinStart }),
                ...(pinEnd && { end: pinEnd }),
            },
        }),
        ...(columnSizing && { columnSizing }),
        ...(grouping && { grouping }),
        // JSON has no Infinity ("all rows"), so such a page size is left out.
        ...(Number.isFinite(pageSize) && { pageSize }),
    }
}

/** Reads a saved view; undefined for invalid JSON, another version or any other mismatch. */
export const parseDataTableViewState = (
    json: string
): DataTableViewState | undefined => {
    try {
        const result = dataTableViewStateSchema.safeParse(JSON.parse(json))
        return result.success ? result.data : undefined
    } catch {
        return undefined
    }
}

/** An `initialState` fragment for `useDataTable` that starts on the view. */
export const dataTableViewInitialState = (
    view: DataTableViewState | undefined
): Partial<DataTableState> => {
    if (view === undefined) return {}
    const {
        sorting,
        columnFilters,
        globalFilter,
        columnVisibility,
        columnOrder,
        columnPinning,
        columnSizing,
        grouping,
        pageSize,
    } = view
    return {
        ...(sorting && { sorting }),
        ...(columnFilters && { columnFilters }),
        ...(globalFilter !== undefined && { globalFilter }),
        ...(columnVisibility && { columnVisibility }),
        ...(columnOrder && { columnOrder }),
        ...(columnPinning && {
            columnPinning: {
                start: columnPinning.start ?? [],
                end: columnPinning.end ?? [],
            },
        }),
        ...(columnSizing && { columnSizing }),
        ...(grouping && { grouping }),
        ...(pageSize !== undefined && {
            pagination: { pageIndex: 0, pageSize },
        }),
    }
}

/**
 * Puts the table on the view: every slice the view has is set, every other
 * one goes back to the table's initial state, and the table goes to page 0.
 */
export const applyDataTableViewState = <TData>(
    table: DataTableInstance<TData>,
    view: DataTableViewState
): void => {
    const { columnPinning } = view
    if (view.sorting) table.setSorting(view.sorting)
    else table.resetSorting()
    if (view.columnFilters) table.setColumnFilters(view.columnFilters)
    else table.resetColumnFilters()
    if (view.globalFilter !== undefined)
        table.setGlobalFilter(view.globalFilter)
    else table.resetGlobalFilter()
    if (view.columnVisibility) table.setColumnVisibility(view.columnVisibility)
    else table.resetColumnVisibility()
    if (view.columnOrder) table.setColumnOrder(view.columnOrder)
    else table.resetColumnOrder()
    if (columnPinning) {
        table.setColumnPinning({
            start: columnPinning.start ?? [],
            end: columnPinning.end ?? [],
        })
    } else {
        table.resetColumnPinning()
    }
    if (view.columnSizing) table.setColumnSizing(view.columnSizing)
    else table.resetColumnSizing()
    if (view.grouping) table.setGrouping(view.grouping)
    else table.resetGrouping()
    // Last: in server mode a query change moves to page 0 by itself.
    table.setPagination(() => ({
        pageIndex: 0,
        pageSize: view.pageSize ?? table.initialState.pagination.pageSize,
    }))
}
