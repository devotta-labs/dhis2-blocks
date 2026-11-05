import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import type { Range } from '@tanstack/react-virtual'
import { useCallback, useMemo, useState } from 'react'
import type { RefObject, SyntheticEvent } from 'react'
import type { GridTable } from '../model/types'
import type { BulkTarget } from './BulkMenu'
import type { NavKey } from './navigation'
import type { NotesTarget } from './RowNotes'
import { TableRow } from './TableRow'

// A row's least height: its cells' `h-9`.
const ROW_HEIGHT = 36
// Rows drawn beyond each edge of the view, so a short scroll shows rows at once.
const OVERSCAN = 5

interface TableBodyProps {
    idScope: string
    table: GridTable
    labels: ReadonlyArray<string>
    move(key: NavKey): void
    openMenu(target: BulkTarget): void
    openNotes(target: NotesTarget): void
    /** The table's scrolling region. */
    region: RefObject<HTMLDivElement>
    /** The sticky header's height, above the first row. */
    headerHeight: number
    /** A row to draw wherever the region has scrolled, for a cell about to get focus. */
    reveal?: number
}

/** Space for rows not drawn, out of the accessibility tree. */
const Gap = ({ height, span }: { height: number; span: number }) => (
    <tr aria-hidden="true">
        <td colSpan={span} className="p-0" style={{ height }} />
    </tr>
)

/**
 * A table's rows, only those near the view drawn, each measured. The first and last rows stay drawn, so Tab into the
 * table lands as it would; so do the row the person was last in and the rows either side, so the arrows, Enter and Tab
 * find their next cell, and the menus opened from a row keep it.
 */
export const TableBody = ({
    idScope,
    table,
    labels,
    move,
    openMenu,
    openNotes,
    region,
    headerHeight,
    reveal,
}: TableBodyProps) => {
    const { rows } = table
    const count = rows.length
    // By id, so rows added above it never move it.
    const [current, setCurrent] = useState<string>()
    const at = useMemo(
        () => rows.findIndex(({ id }) => id === current),
        [rows, current]
    )
    const rangeExtractor = useCallback(
        (range: Range) =>
            [
                ...new Set([
                    0,
                    count - 1,
                    at - 1,
                    at,
                    at + 1,
                    reveal ?? -1,
                    ...defaultRangeExtractor(range),
                ]),
            ]
                .filter((index) => index >= 0 && index < count)
                .sort((a, b) => a - b),
        [count, at, reveal]
    )
    const virtualizer = useVirtualizer({
        count,
        getScrollElement: () => region.current,
        // The region is at most 70% of the screen tall: rows are drawn on the first render, before it is measured.
        initialRect: { width: 0, height: window.innerHeight * 0.7 },
        estimateSize: () => ROW_HEIGHT,
        overscan: OVERSCAN,
        paddingStart: headerHeight,
        getItemKey: (index) => rows[index]?.id ?? index,
        rangeExtractor,
    })
    const note = (event: SyntheticEvent) => {
        const row =
            event.target instanceof Element
                ? rows[Number(event.target.closest('tr')?.dataset.index)]
                : undefined
        if (row !== undefined) {
            setCurrent(row.id)
        }
    }
    const span = table.columns.length + 2
    let end = headerHeight
    const drawn = virtualizer.getVirtualItems().flatMap((item) => {
        const row = rows[item.index]
        const gap = item.start - end
        end = item.end
        return row === undefined
            ? []
            : [
                  gap > 0 ? (
                      <Gap key={`gap-${row.id}`} height={gap} span={span} />
                  ) : null,
                  <TableRow
                      key={row.id}
                      idScope={idScope}
                      table={table}
                      row={row}
                      index={item.index}
                      rowIndex={table.headerRows.length + item.index + 1}
                      measure={virtualizer.measureElement}
                      labels={labels}
                      move={move}
                      openMenu={openMenu}
                      openNotes={openNotes}
                  />,
              ]
    })
    const after = virtualizer.getTotalSize() - end
    return (
        <tbody onFocus={note} onPointerDown={note}>
            {drawn}
            {after > 0 ? <Gap height={after} span={span} /> : null}
        </tbody>
    )
}
