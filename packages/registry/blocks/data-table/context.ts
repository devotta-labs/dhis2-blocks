import { createContext, useContext, type ReactNode } from 'react'
import type {
    DataTableDensity,
    DataTableLayout,
    DataTableStatus,
} from './types'

export interface DataTableViewContextValue {
    label: string
    status: DataTableStatus
    error: ReactNode
    onRetry: (() => void) | undefined
    hasNextPage: boolean | undefined
    layout: DataTableLayout
    density: DataTableDensity
    setDensity: (density: DataTableDensity) => void
}

export const DataTableViewContext =
    createContext<DataTableViewContextValue | null>(null)

export const useDataTableView = (): DataTableViewContextValue => {
    const context = useContext(DataTableViewContext)
    if (!context) {
        throw new Error('DataTable parts must be rendered inside <DataTable>')
    }
    return context
}
