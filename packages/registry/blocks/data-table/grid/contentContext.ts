import { createContext, useContext, type ReactNode } from 'react'

/*
 * One context serves every row type, so the row callbacks take the row's id;
 * `<DataTableContent>` looks the row up in its own typed table.
 */
export interface DataTableContentContextValue {
    onRowOpen: ((rowId: string) => void) | undefined
    rowOpenLabel: ((rowId: string) => string) | undefined
    renderExpandedRow: ((rowId: string) => ReactNode) | undefined
    emptyState: ReactNode
    columnMenu: boolean
    stickyHeader: boolean
    /** True only when `virtualized` was asked for and `maxHeight` is set. */
    virtualized: boolean
    estimateRowHeight: number
    /** The table's scroll container, once it is mounted. */
    scrollElement: HTMLDivElement | null
}

export const DEFAULT_ROW_HEIGHT = 48

const defaults: DataTableContentContextValue = {
    onRowOpen: undefined,
    rowOpenLabel: undefined,
    renderExpandedRow: undefined,
    emptyState: undefined,
    columnMenu: false,
    stickyHeader: false,
    virtualized: false,
    estimateRowHeight: DEFAULT_ROW_HEIGHT,
    scrollElement: null,
}

export const DataTableContentContext =
    createContext<DataTableContentContextValue | null>(null)

/** The options of the enclosing `<DataTableContent>`, or defaults outside one. */
export const useDataTableContent = (): DataTableContentContextValue => {
    const context = useContext(DataTableContentContext)
    return context ?? defaults
}
