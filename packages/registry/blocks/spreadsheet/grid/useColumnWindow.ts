import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import type { Range, Rect, Virtualizer } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject, SyntheticEvent } from 'react'
import type { GridTable } from '../model/types'
import { useSpreadsheetContext } from '../provider/context'
import { tabStops } from './columnWindow'
import type { ColumnWindow } from './columnWindow'

// A column's least width: its cells' `min-w-28`. Its heading can make it wider, which is measured once it is drawn.
const COLUMN_WIDTH = 112
// Columns drawn beyond each edge of the view, so a short scroll shows columns at once.
const OVERSCAN = 2

type Columns = Virtualizer<HTMLDivElement, Element>

/** A drawn column's width as the browser laid it out, a fraction of a pixel included; the estimate until it reports. */
const widthOf = (
    element: Element,
    entry: ResizeObserverEntry | undefined,
    instance: Columns
) => {
    const index = instance.indexFromElement(element)
    return (
        entry?.borderBoxSize[0]?.inlineSize ??
        instance.itemSizeCache.get(instance.options.getItemKey(index)) ??
        instance.options.estimateSize(index)
    )
}

/** Scrolls the region sideways to an offset from its start: in a right-to-left table that is a negative `scrollLeft`. */
const scrollTo = (
    offset: number,
    {
        adjustments = 0,
        behavior,
    }: { adjustments?: number; behavior?: ScrollBehavior },
    instance: Columns
) =>
    instance.scrollElement?.scrollTo({
        left: (instance.options.isRtl ? -1 : 1) * (offset + adjustments),
        behavior,
    })

/**
 * Which of a table's columns to draw: those in the region's view between its sticky row headers and actions, a few
 * beyond, and the ones the keys reach from where the person is, so Tab, the arrows and the menus find their cell. The
 * columns left out keep their width as gaps: the measured one, or the least a column takes until it has been drawn.
 */
export const useColumnWindow = (
    table: GridTable,
    region: RefObject<HTMLDivElement>,
    /** A column to draw wherever the region has scrolled, and to scroll to, for a cell about to get focus. */
    reveal: number | undefined
) => {
    const { keyOf } = useSpreadsheetContext()
    const { rows, columns } = table
    const count = columns.length
    // By id, so rows and columns added before them never move them.
    const [current, setCurrent] = useState<{ row?: string; column?: string }>(
        {}
    )
    const row = useMemo(
        () => rows.findIndex(({ id }) => id === current.row),
        [rows, current.row]
    )
    const kept = useMemo(() => {
        const column = columns.findIndex(({ id }) => id === current.column)
        return [
            column,
            ...tabStops(table, keyOf, row === -1 ? undefined : row, column),
        ]
    }, [table, keyOf, columns, row, current.column])
    const rangeExtractor = useCallback(
        (range: Range) =>
            [
                ...new Set([
                    ...kept,
                    reveal ?? -1,
                    ...defaultRangeExtractor(range),
                ]),
            ]
                .filter((index) => index >= 0 && index < count)
                .sort((a, b) => a - b),
        [kept, reveal, count]
    )

    // The sticky cells at each end of the heading: the columns show between them.
    const startInset = useRef<HTMLTableCellElement>(null)
    const endInset = useRef<HTMLTableCellElement>(null)
    const observeElementRect = useCallback(
        (instance: Columns, report: (rect: Rect) => void) => {
            const scroller = instance.scrollElement
            if (scroller === null) {
                return undefined
            }
            const measure = () =>
                report({
                    width: Math.max(
                        scroller.clientWidth -
                            (startInset.current?.offsetWidth ?? 0) -
                            (endInset.current?.offsetWidth ?? 0),
                        0
                    ),
                    height: scroller.clientHeight,
                })
            measure()
            const observer = new ResizeObserver(measure)
            observer.observe(scroller)
            return () => observer.disconnect()
        },
        []
    )
    const [rtl, setRtl] = useState(false)
    useLayoutEffect(() => {
        if (region.current !== null) {
            setRtl(getComputedStyle(region.current).direction === 'rtl')
        }
    })

    const virtualizer = useVirtualizer({
        count,
        horizontal: true,
        isRtl: rtl,
        getScrollElement: () => region.current,
        // The region is at most as wide as the screen: columns are drawn on the first render, before it is measured.
        initialRect: { width: window.innerWidth, height: 0 },
        estimateSize: () => COLUMN_WIDTH,
        overscan: OVERSCAN,
        getItemKey: (index) => columns[index]?.id ?? index,
        indexAttribute: 'data-column',
        rangeExtractor,
        observeElementRect,
        measureElement: widthOf,
        scrollToFn: scrollTo,
    })
    // The column is drawn at its place among the gaps; the region scrolls there, and stays as the columns that come
    // into view beside it are measured.
    useLayoutEffect(() => {
        if (reveal !== undefined) {
            virtualizer.scrollToIndex(reveal)
        }
    }, [reveal, virtualizer])

    let end = 0
    const drawn = virtualizer.getVirtualItems().map((item) => {
        const gap = item.start - end
        end = item.end
        return { index: item.index, gap }
    })
    const after = Math.max(virtualizer.getTotalSize() - end, 0)
    const same = `${drawn.map(({ index, gap }) => `${index}:${gap}`).join(' ')} ${after}`
    // The same window for as long as it holds the same columns and gaps, so a row is drawn again only when it changes.
    const window_ = useMemo(
        (): ColumnWindow => ({ drawn, after }),
        // `same` is all that `drawn` and `after` say.
        [same]
    )

    /** Notes the row and column that hold focus, or were last pressed. */
    const note = useCallback(
        (event: SyntheticEvent) => {
            if (!(event.target instanceof Element)) {
                return
            }
            const noted =
                rows[Number(event.target.closest('tr')?.dataset.index)]?.id
            const column =
                columns[
                    Number(
                        event.target.closest<HTMLElement>('[data-column]')
                            ?.dataset.column
                    )
                ]?.id
            setCurrent((was) => {
                // A heading is in no row: the row last noted stays.
                const next =
                    noted === undefined
                        ? { row: was.row, column: column ?? was.column }
                        : { row: noted, column }
                return next.row === was.row && next.column === was.column
                    ? was
                    : next
            })
        },
        [rows, columns]
    )

    return {
        columns: window_,
        /** The row last noted, by its place among the table's rows; -1 when none. */
        row,
        note,
        /** Measures a drawn column by its heading, which carries `data-column`. */
        measure: virtualizer.measureElement,
        startInset,
        endInset,
    }
}
