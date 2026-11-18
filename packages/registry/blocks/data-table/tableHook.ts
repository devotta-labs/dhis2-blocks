import {
    createTableHook,
    type Cell,
    type Column,
    type ColumnDef,
    type Header,
    type Row,
    type RowData,
    type TableState,
} from '@tanstack/react-table'
import { dataTableFeatures, type DataTableFeatures } from './features'

/**
 * Left to inference, the component registries widen to an index signature and
 * every property access on the table would type-check.
 */
type NoComponents = Record<never, never>

const hook = createTableHook<
    DataTableFeatures,
    NoComponents,
    NoComponents,
    NoComponents
>({ features: dataTableFeatures })

export const createDataTableColumnHelper = hook.createAppColumnHelper
export const useAppTable = hook.useAppTable
export const useDataTableInstance = hook.useTableContext

/**
 * TanStack types need an object or array row type. A row type parameter that is
 * not known to be one (a bare `<TData,>` generic) resolves through this, so the
 * public types accept any `TData`.
 */
export type DataTableRowData<TData> = Extract<TData, RowData>

/** The table `useDataTable` returns for rows of type `TData`. */
export type DataTableInstance<TData> = ReturnType<
    typeof useAppTable<DataTableRowData<TData>>
>
/** A column definition `useDataTable` accepts. */
export type DataTableColumnDef<TData> = ColumnDef<
    DataTableFeatures,
    DataTableRowData<TData>,
    // Each column has its own value type; `helper.columns()` yields `any` here too.
    any
>
export type DataTableRow<TData> = Row<
    DataTableFeatures,
    DataTableRowData<TData>
>
export type DataTableCell<TData> = Cell<
    DataTableFeatures,
    DataTableRowData<TData>
>
export type DataTableColumn<TData> = Column<
    DataTableFeatures,
    DataTableRowData<TData>
>
export type DataTableHeaderCell<TData> = Header<
    DataTableFeatures,
    DataTableRowData<TData>
>
export type DataTableState = TableState<DataTableFeatures>
