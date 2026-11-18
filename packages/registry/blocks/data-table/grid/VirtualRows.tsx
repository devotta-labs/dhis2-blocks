import type { Row, RowData } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import type { DataTableFeatures } from '../features'
import { useDataTableInstance } from '../tableHook'
import { DataTableDataRow, type DataTableRowsOptions } from './DataTableRows'

const OVERSCAN = 8

/**
 * Scrolls back to the top when sorting, filters or grouping change: the old
 * offset means nothing in the new rows. Not on mount, nor for new data.
 */
const useScrollTopOnQueryChange = (scrollElement: HTMLDivElement | null) => {
    const table = useDataTableInstance()
    const { sorting, columnFilters, globalFilter, grouping } = table.state
    const query = JSON.stringify([
        sorting,
        columnFilters,
        globalFilter,
        grouping,
    ])
    const previous = useRef(query)
    useEffect(() => {
        if (previous.current === query) return
        previous.current = query
        if (scrollElement !== null) scrollElement.scrollTop = 0
    }, [query, scrollElement])
}

/** Keeps the scroll height of the rows that are not drawn. */
const Spacer = ({ height, span }: { height: number; span: number }) => (
    <tr aria-hidden="true">
        <td colSpan={span} className="p-0" style={{ height: `${height}px` }} />
    </tr>
)

/** Draws only the rows in and near the scroll container's view. */
export const VirtualRows = <TData extends RowData>({
    rows,
    options,
    span,
    scrollElement,
    estimateRowHeight,
}: {
    rows: Row<DataTableFeatures, TData>[]
    options: DataTableRowsOptions<TData>
    span: number
    scrollElement: HTMLDivElement | null
    estimateRowHeight: number
}) => {
    useScrollTopOnQueryChange(scrollElement)
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollElement,
        estimateSize: () => estimateRowHeight,
        overscan: OVERSCAN,
        getItemKey: (index) => rows.at(index)?.id ?? index,
    })
    const items = virtualizer.getVirtualItems()
    const before = items.at(0)?.start ?? 0
    const after = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0)
    return (
        <>
            {before > 0 && <Spacer height={before} span={span} />}
            {items.map((item) => {
                const row = rows.at(item.index)
                return (
                    row !== undefined && (
                        <DataTableDataRow
                            key={row.id}
                            row={row}
                            position={item.index}
                            options={options}
                            measure={virtualizer.measureElement}
                            virtualIndex={item.index}
                        />
                    )
                )
            })}
            {after > 0 && <Spacer height={after} span={span} />}
        </>
    )
}
