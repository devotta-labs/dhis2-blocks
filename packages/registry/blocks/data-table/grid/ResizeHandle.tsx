import i18n from '@dhis2/d2-i18n'
import type { Header, RowData } from '@tanstack/react-table'
import { cn } from '@/components/dhis2/ui/cn'
import type { KeyboardEvent } from 'react'
import type { DataTableFeatures } from '../features'
import { isLastDrawnColumn } from './sizing'

const STEP = 16

const clamp = (value: number, min = 0, max = Number.POSITIVE_INFINITY) =>
    Math.min(Math.max(value, min), max)

/**
 * The drag handle on a header's end edge: 24px wide, centred on the border,
 * so it covers only the 12px inline padding of the cells on either side. The
 * last column's sits inside the cell, which makes room for it. Arrow
 * keys change the width by 16px, towards the end edge growing it in either
 * text direction.
 */
export const ResizeHandle = <TData extends RowData>({
    header,
    label,
}: {
    header: Header<DataTableFeatures, TData, unknown>
    label: string
}) => {
    const column = header.column
    const startResizing = header.getResizeHandler()
    const last = isLastDrawnColumn(column)

    const resizeByKey = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Home') {
            event.preventDefault()
            column.resetSize()
            return
        }
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
        const grows = (event.key === 'ArrowRight') !== rtl
        const { minSize, maxSize } = column.columnDef
        const size = clamp(
            column.getSize() + (grows ? STEP : -STEP),
            minSize,
            maxSize
        )
        column.table.setColumnSizing((sizing) => ({
            ...sizing,
            [column.id]: size,
        }))
    }

    return (
        <button
            type="button"
            data-slot="data-table-resize"
            data-resizing={column.getIsResizing() ? '' : undefined}
            aria-label={i18n.t('Resize {{column}}', { column: label })}
            className={cn(
                'absolute inset-y-0 z-10 w-6 cursor-col-resize touch-none border-0 bg-transparent p-0 outline-none after:absolute after:inset-y-1.5 after:w-0.5 after:rounded-full after:bg-transparent hover:after:bg-dhis2-border-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-dhis2-ring data-resizing:after:bg-dhis2-primary',
                last ? 'end-0 after:end-0' : '-end-3 after:end-[11px]'
            )}
            onMouseDown={startResizing}
            onTouchStart={startResizing}
            onDoubleClick={() => column.resetSize()}
            onKeyDown={resizeByKey}
        />
    )
}
