import i18n from '@dhis2/d2-i18n'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import { TableCell, TableRow } from '@/components/dhis2/ui/table'
import type { ReactNode } from 'react'
import { useDataTableView } from '../context'
import { useDataTableInstance } from '../tableHook'
import { cellDensityClass, drawnColumns } from './sizing'

const SKELETON_WIDTHS = [
    'w-[46%]',
    'w-[62%]',
    'w-[34%]',
    'w-[54%]',
    'w-[40%]',
] as const

const MAX_SKELETON_ROWS = 10

// The bar sits where the column's text would.
const skeletonAlign = {
    start: undefined,
    center: 'mx-auto',
    end: 'ms-auto',
} as const

const skeletonWidth = (row: number, column: number) =>
    SKELETON_WIDTHS[(row * 3 + column) % SKELETON_WIDTHS.length]

/** Placeholder rows for the first load, as many as a page holds (at most 10). */
export const SkeletonRows = ({
    pageSize,
    columnCount,
}: {
    pageSize: number
    columnCount: number
}) => {
    const { density } = useDataTableView()
    const table = useDataTableInstance()
    const columns = drawnColumns(table)
    const rowCount = Math.max(1, Math.min(pageSize, MAX_SKELETON_ROWS))
    return Array.from({ length: rowCount }, (_, row) => (
        <TableRow key={row} data-slot="data-table-skeleton" aria-hidden="true">
            {Array.from({ length: columnCount }, (_, column) => (
                <TableCell key={column} className={cellDensityClass(density)}>
                    <Skeleton
                        className={cn(
                            'h-3.5 rounded-[3px]',
                            skeletonWidth(row, column),
                            skeletonAlign[
                                columns.at(column)?.columnDef.meta?.align ??
                                    'start'
                            ]
                        )}
                    />
                </TableCell>
            ))}
        </TableRow>
    ))
}

const MessageRow = ({
    slot,
    span,
    children,
}: {
    slot: string
    span: number
    children: ReactNode
}) => (
    <TableRow data-slot={slot}>
        <TableCell
            colSpan={span}
            className="py-10 text-center group-hover/table-row:bg-dhis2-background group-active/table-row:bg-dhis2-background"
        >
            {children}
        </TableCell>
    </TableRow>
)

export const ErrorRow = ({ span }: { span: number }) => {
    const { error, onRetry } = useDataTableView()
    return (
        <MessageRow slot="data-table-error" span={span}>
            <div className="flex flex-col items-start gap-3 text-start">
                {/* `<DataTable>` announces the failure, so the alert does not. */}
                <ErrorAlert
                    role="none"
                    title={error ?? i18n.t('The list could not be loaded.')}
                />
                {onRetry !== undefined && (
                    <Button variant="secondary" size="sm" onClick={onRetry}>
                        {i18n.t('Retry')}
                    </Button>
                )}
            </div>
        </MessageRow>
    )
}

export const EmptyRow = ({
    span,
    emptyState,
}: {
    span: number
    emptyState: ReactNode
}) => {
    const table = useDataTableInstance()
    const { columnFilters, globalFilter } = table.state
    const filtered =
        columnFilters.length > 0 ||
        (globalFilter !== undefined &&
            globalFilter !== null &&
            String(globalFilter).trim() !== '')
    if (!filtered) {
        return (
            <MessageRow slot="data-table-empty" span={span}>
                {emptyState ?? i18n.t('No items to display')}
            </MessageRow>
        )
    }
    return (
        <MessageRow slot="data-table-empty" span={span}>
            <div className="flex flex-col items-center gap-3">
                <span>{i18n.t('No results match your filters')}</span>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                        table.resetColumnFilters(true)
                        table.resetGlobalFilter(true)
                    }}
                >
                    {i18n.t('Clear filters')}
                </Button>
            </div>
        </MessageRow>
    )
}
