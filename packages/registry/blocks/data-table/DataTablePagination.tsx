import i18n from '@dhis2/d2-i18n'
import { IconChevronLeft16, IconChevronRight16 } from '@dhis2/ui-icons'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import { useId } from 'react'
import { useDataTableView } from './context'
import { totalRowCount } from './grid/rowCount'
import { useDataTableInstance } from './tableHook'

export interface DataTablePaginationProps {
    className?: string
    /** Default [10, 25, 50, 100]. */
    pageSizes?: readonly number[]
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const

/** The offered page sizes, with the current one added when it is missing. */
const pageSizeOptions = (pageSizes: readonly number[], pageSize: number) =>
    (pageSizes.includes(pageSize) ? [...pageSizes] : [...pageSizes, pageSize])
        .sort((a, b) => a - b)
        .map((size) => ({ value: size, label: String(size) }))

const pageInfo = ({
    pageIndex,
    pageSize,
    total,
}: {
    pageIndex: number
    pageSize: number
    total: number | undefined
}) => {
    if (total === undefined) {
        return i18n.t('Page {{page}}', { page: pageIndex + 1 })
    }
    if (total === 0) return i18n.t('No rows')
    // 0 × Infinity is NaN: with one endless page there is no offset.
    const offset = pageIndex === 0 ? 0 : pageIndex * pageSize
    return i18n.t('{{from}}–{{to}} of {{total}}', {
        from: offset + 1,
        to: Math.min(offset + pageSize, total),
        total,
    })
}

/** Rows per page, where the page is, and Previous / Next. */
export const DataTablePagination = ({
    className,
    pageSizes = DEFAULT_PAGE_SIZES,
}: DataTablePaginationProps) => {
    const table = useDataTableInstance()
    const view = useDataTableView()
    const labelId = useId()
    const { pageIndex, pageSize } = table.state.pagination
    const loading = view.status === 'loading'
    const total = totalRowCount(table)
    const pageIsFull = table.getRowModel().rows.length >= pageSize
    const canNext =
        total === undefined
            ? (view.hasNextPage ?? pageIsFull)
            : table.getCanNextPage()
    const items = pageSizeOptions(pageSizes, pageSize)

    return (
        <nav
            aria-label={i18n.t('Pagination')}
            data-slot="data-table-pagination"
            className={cn(
                'flex min-h-14 flex-wrap items-center justify-between gap-3 px-3 py-2',
                className
            )}
        >
            <div className="flex min-h-(--dhis2-field-height-dense) items-center gap-2">
                <span
                    id={labelId}
                    className="text-sm text-dhis2-subtle-foreground"
                >
                    {i18n.t('Rows per page')}
                </span>
                <Select
                    items={items}
                    value={pageSize}
                    disabled={loading}
                    onValueChange={(next) => {
                        if (next !== null) table.setPageSize(next)
                    }}
                >
                    <SelectTrigger
                        size="sm"
                        aria-labelledby={labelId}
                        data-slot="data-table-page-size"
                        className="w-auto"
                    >
                        <SelectValue className="flex-none" />
                    </SelectTrigger>
                    <SelectContent>
                        {items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex min-h-(--dhis2-field-height-dense) flex-wrap items-center gap-3">
                <span
                    data-slot="data-table-page-info"
                    className="text-sm text-dhis2-foreground"
                >
                    {pageInfo({ pageIndex, pageSize, total })}
                </span>
                <div className="flex items-center gap-1">
                    <Button
                        variant="secondary"
                        size="field-dense"
                        className="ps-0"
                        data-slot="data-table-page-previous"
                        disabled={loading || !table.getCanPreviousPage()}
                        focusableWhenDisabled
                        onClick={() => table.previousPage()}
                    >
                        <span className="flex rtl:rotate-180">
                            <IconChevronLeft16 />
                        </span>
                        {i18n.t('Previous')}
                    </Button>
                    <Button
                        variant="secondary"
                        size="field-dense"
                        className="pe-0"
                        data-slot="data-table-page-next"
                        disabled={loading || !canNext}
                        focusableWhenDisabled
                        onClick={() => table.nextPage()}
                    >
                        {i18n.t('Next')}
                        <span className="flex rtl:rotate-180">
                            <IconChevronRight16 />
                        </span>
                    </Button>
                </div>
            </div>
        </nav>
    )
}
