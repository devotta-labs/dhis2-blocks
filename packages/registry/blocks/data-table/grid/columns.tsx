import i18n from '@dhis2/d2-i18n'
import { IconChevronDown16, IconChevronRight16 } from '@dhis2/ui-icons'
import type { Row, RowData } from '@tanstack/react-table'
import { Button } from '@/components/dhis2/ui/button'
import type { DataTableFeatures } from '../features'
import type { DataTableColumnDef } from '../tableHook'
import { dataTableRowNumber } from './rowNumber'

export const DATA_TABLE_EXPAND_COLUMN_ID = 'expand'

const EXPANDER_SIZE = 44

const Expander = <TData extends RowData>({
    row,
}: {
    row: Row<DataTableFeatures, TData>
}) => {
    if (!row.getCanExpand()) return null
    const expanded = row.getIsExpanded()
    return (
        <Button
            variant="ghost"
            size="icon-sm"
            data-slot="data-table-expander"
            aria-expanded={expanded}
            aria-label={
                expanded
                    ? i18n.t('Collapse row {{n}}', {
                          n: dataTableRowNumber(row),
                      })
                    : i18n.t('Expand row {{n}}', { n: dataTableRowNumber(row) })
            }
            onClick={() => row.toggleExpanded()}
            style={{ marginInlineStart: `${row.depth * 16}px` }}
        >
            {expanded ? (
                <IconChevronDown16 />
            ) : (
                <span className="flex rtl:rotate-180">
                    <IconChevronRight16 />
                </span>
            )}
        </Button>
    )
}

/**
 * A narrow first column with a button that expands its row: to its sub-rows,
 * or to `renderExpandedRow`'s detail (with `getRowCanExpand: () => true`).
 */
export const dataTableExpanderColumn = <
    TData,
>(): DataTableColumnDef<TData> => ({
    id: DATA_TABLE_EXPAND_COLUMN_ID,
    size: EXPANDER_SIZE,
    // The table's default `minSize` would widen it.
    minSize: EXPANDER_SIZE,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGrouping: false,
    meta: { label: i18n.t('Expand') },
    header: () => <span className="sr-only">{i18n.t('Expand')}</span>,
    cell: ({ row }) => <Expander row={row} />,
})
