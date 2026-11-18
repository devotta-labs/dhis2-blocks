import i18n from '@dhis2/d2-i18n'
import { announce } from '@/components/dhis2/ui/announcer'
import { cn } from '@/components/dhis2/ui/cn'
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ComponentProps,
    type ReactNode,
} from 'react'
import { DataTableViewContext, type DataTableViewContextValue } from './context'
import type { DataTableInstance } from './tableHook'
import type {
    DataTableDensity,
    DataTableLayout,
    DataTableStatus,
} from './types'

export interface DataTableProps<TData> extends Omit<
    ComponentProps<'div'>,
    'children'
> {
    table: DataTableInstance<TData>
    /** Accessible name of the table. */
    label: string
    children: ReactNode
    /** Default 'ready'. 'loading': first load, no rows yet. 'updating': rows stay while new ones load. */
    status?: DataTableStatus
    /** Shown by the error state. Default: "The list could not be loaded." */
    error?: ReactNode
    onRetry?: () => void
    /** Server mode without `rowCount`: whether a next page exists. */
    hasNextPage?: boolean
    /** 'auto' (default): the browser sizes columns. 'fixed': columns use their sizes, which enables resizing and pinning. */
    layout?: DataTableLayout
    density?: DataTableDensity
    /** Default 'normal'. */
    defaultDensity?: DataTableDensity
    onDensityChange?: (density: DataTableDensity) => void
}

const useStatusAnnouncements = <TData,>(
    status: DataTableStatus,
    table: DataTableInstance<TData>
) => {
    const previous = useRef(status)
    useEffect(() => {
        const before = previous.current
        previous.current = status
        if (before === status) return
        if (status === 'error') {
            announce(i18n.t('The list could not be loaded.'))
        } else if (
            status === 'ready' &&
            (before === 'loading' || before === 'updating')
        ) {
            announce(
                i18n.t('{{count}} rows shown', {
                    count: table.getRowModel().rows.length,
                })
            )
        }
    }, [status, table])
}

export const DataTable = <TData,>({
    table,
    label,
    children,
    status = 'ready',
    error,
    onRetry,
    hasNextPage,
    layout = 'auto',
    density: controlledDensity,
    defaultDensity = 'normal',
    onDensityChange,
    className,
    ...rest
}: DataTableProps<TData>) => {
    const [ownDensity, setOwnDensity] = useState(defaultDensity)
    const density = controlledDensity ?? ownDensity
    const setDensity = useCallback(
        (next: DataTableDensity) => {
            setOwnDensity(next)
            onDensityChange?.(next)
        },
        [onDensityChange]
    )
    useStatusAnnouncements(status, table)
    const view = useMemo(
        () =>
            ({
                label,
                status,
                error,
                onRetry,
                hasNextPage,
                layout,
                density,
                setDensity,
            }) satisfies DataTableViewContextValue,
        [
            label,
            status,
            error,
            onRetry,
            hasNextPage,
            layout,
            density,
            setDensity,
        ]
    )
    return (
        <table.AppTable>
            <DataTableViewContext.Provider value={view}>
                <div
                    data-slot="data-table"
                    data-status={status}
                    data-density={density}
                    data-layout={layout}
                    className={cn('flex w-full min-w-0 flex-col', className)}
                    {...rest}
                >
                    {children}
                </div>
            </DataTableViewContext.Provider>
        </table.AppTable>
    )
}
