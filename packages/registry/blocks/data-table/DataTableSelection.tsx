import i18n from '@dhis2/d2-i18n'
import { Button } from '@/components/dhis2/ui/button'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Subscribe,
    type Row,
    type RowData,
    type Table,
} from '@tanstack/react-table'
import { useEffect, useRef, type ReactNode } from 'react'
import type { DataTableFeatures } from './features'
import { FILTER_FOCUS_TARGETS, useFocusAfterRemoval } from './focusAfterRemoval'
import { dataTableRowNumber } from './grid/rowNumber'
import {
    createDataTableColumnHelper,
    useDataTableInstance,
    type DataTableColumnDef,
    type DataTableRowData,
} from './tableHook'

export const DATA_TABLE_SELECT_COLUMN_ID = 'select'

/** Where focus goes when the bar goes away while it has focus. */
const SELECTION_FOCUS_TARGETS: readonly string[] = [
    `[data-slot="data-table-head"][data-column-id="${DATA_TABLE_SELECT_COLUMN_ID}"] [data-slot="checkbox"]`,
    ...FILTER_FOCUS_TARGETS,
]

const SelectAllCheckbox = <TData extends RowData>({
    table,
}: {
    table: Table<DataTableFeatures, TData>
}) => (
    <Subscribe
        source={table.store}
        selector={() => ({
            all: table.getIsAllPageRowsSelected(),
            some: table.getIsSomePageRowsSelected(),
        })}
    >
        {({ all, some }) => (
            <Checkbox
                aria-label={i18n.t('Select all rows on this page')}
                checked={all}
                indeterminate={some && !all}
                onCheckedChange={(checked) =>
                    table.toggleAllPageRowsSelected(checked)
                }
            />
        )}
    </Subscribe>
)

const SelectRowCheckbox = <TData extends RowData>({
    table,
    row,
}: {
    table: Table<DataTableFeatures, TData>
    row: Row<DataTableFeatures, TData>
}) => (
    <Subscribe
        source={table.atoms.rowSelection}
        selector={(selection) => selection[row.id] === true}
    >
        {(selected) => (
            <Checkbox
                aria-label={i18n.t('Select row {{n}}', {
                    n: dataTableRowNumber(row),
                })}
                checked={selected}
                disabled={!row.getCanSelect()}
                onMouseDown={(event) => {
                    // Shift would also select the page text in between.
                    if (!event.shiftKey) return
                    event.preventDefault()
                    event.currentTarget.focus()
                }}
                onCheckedChange={(checked, details) =>
                    // The click carries the shift key, which selects a range.
                    row.getToggleSelectedHandler()({
                        target: { checked },
                        nativeEvent: details.event,
                    })
                }
            />
        )}
    </Subscribe>
)

/** A checkbox column for row selection; put it first in `columns`. */
export const dataTableSelectionColumn = <TData,>(): DataTableColumnDef<TData> =>
    createDataTableColumnHelper<DataTableRowData<TData>>().display({
        id: DATA_TABLE_SELECT_COLUMN_ID,
        size: 44,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        enableGrouping: false,
        meta: { label: i18n.t('Select') },
        header: ({ table }) => <SelectAllCheckbox table={table} />,
        cell: ({ table, row }) => <SelectRowCheckbox table={table} row={row} />,
    })

export interface DataTableSelectionBarProps {
    className?: string
    /** Bulk actions. A function receives the selected row ids. */
    children?: ReactNode | ((selectedIds: readonly string[]) => ReactNode)
    /** Rows matching the current filters on the server, to offer "Select all {{total}}". */
    totalMatching?: number
    /** Caller-owned: true when the user chose every matching row, not only loaded ones. */
    allMatching?: boolean
    onAllMatchingChange?: (allMatching: boolean) => void
}

/** The selected count, "Select all", "Clear selection" and bulk actions. */
export const DataTableSelectionBar = ({
    className,
    children,
    totalMatching,
    allMatching,
    onAllMatchingChange,
}: DataTableSelectionBarProps) => {
    const table = useDataTableInstance()
    const rowSelection = table.state.rowSelection
    const selectedIds = Object.keys(rowSelection).filter(
        (id) => rowSelection[id] === true
    )
    const count = selectedIds.length
    const selectionKey = selectedIds.join('\n')

    // Changing the selection by hand ends "every matching row".
    const previousKey = useRef(selectionKey)
    useEffect(() => {
        if (previousKey.current === selectionKey) return
        previousKey.current = selectionKey
        if (allMatching === true) onAllMatchingChange?.(false)
    }, [selectionKey, allMatching, onAllMatchingChange])

    // The bar's own element is gone by then; its table stays.
    const tableRoot = useRef<HTMLElement | null>(null)
    const shown = count > 0 || allMatching === true
    useFocusAfterRemoval(shown ? 1 : 0, tableRoot, SELECTION_FOCUS_TARGETS)

    if (!shown) return null

    const total = totalMatching ?? count
    const offerAll =
        totalMatching !== undefined &&
        onAllMatchingChange !== undefined &&
        allMatching !== true &&
        table.getIsAllPageRowsSelected() &&
        totalMatching > count
    return (
        <div
            ref={(element) => {
                if (element === null) return
                tableRoot.current = element.closest<HTMLElement>(
                    '[data-slot="data-table"]'
                )
            }}
            role="region"
            aria-label={i18n.t('Selection')}
            data-slot="data-table-selection-bar"
            className={cn(
                'flex min-w-0 flex-wrap items-center gap-2 border-b border-dhis2-border bg-dhis2-selected px-3 py-1.5 text-sm',
                className
            )}
        >
            <span className="font-medium">
                {allMatching === true
                    ? i18n.t('All {{total}} selected', { total })
                    : i18n.t('{{count}} selected', { count })}
            </span>
            {offerAll && (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => onAllMatchingChange(true)}
                >
                    {i18n.t('Select all {{total}}', { total })}
                </Button>
            )}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                    table.resetRowSelection(true)
                    onAllMatchingChange?.(false)
                }}
            >
                {i18n.t('Clear selection')}
            </Button>
            {children instanceof Function ? children(selectedIds) : children}
        </div>
    )
}
