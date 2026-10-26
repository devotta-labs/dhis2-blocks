import i18n from '@dhis2/d2-i18n'
import {
    memo,
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import { cellKind } from '@/components/dhis2-value-types'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { Cell } from '../cells/Cell'
import { cellDomId } from '../cells/cellProps'
import { formatCount } from '../cells/OptionCell'
import { cellKey } from '../model/types'
import type { CellKey, GridRow, GridTable } from '../model/types'
import { useDataEntryContext } from '../provider/context'
import type { EffectsState } from '../provider/context'
import { columnHeaderIds, headerDomId, rowHeaderDomId } from './headers'
import { nextCell } from './navigation'
import type { CellPosition, NavGrid, NavKey } from './navigation'
import { isBlock, parseBlock, pasteTargets } from './paste'

/** What `nextCell` and `pasteTargets` walk; each lookup is a map read, as they ask once per cell stepped over. */
const navGrid = (
    tables: ReadonlyArray<GridTable>,
    effects: StoreApi<EffectsState>
): NavGrid => ({
    tables: tables.map(({ rows, columns, closed }) => {
        const keyAt = (row: number, column: number) =>
            cellKey(rows[row].id, columns[column].id)
        // Pop-up and read-only kinds are edited in their own form, never pasted into.
        const elsewhere = columns.map(({ field }) => {
            const kind = cellKind(field)
            return kind === 'popup' || kind === 'readOnly'
        })
        const isOpen = (row: number, column: number) =>
            !closed.has(keyAt(row, column))
        return {
            rows: rows.length,
            columns: columns.length,
            isOpen,
            isEditable(row, column) {
                if (elsewhere[column] || !isOpen(row, column)) {
                    return false
                }
                const cell = effects.getState().cells[keyAt(row, column)]
                return (
                    cell?.readOnly === undefined && cell?.hiddenBy === undefined
                )
            },
        }
    }),
})

/** Where each cell control is, by its DOM id; closed cells have no control. */
const positionsOf = (tables: ReadonlyArray<GridTable>) => {
    const positions = new Map<string, CellPosition>()
    tables.forEach(({ rows, columns, closed }, table) => {
        rows.forEach(({ id: rowId }, row) => {
            columns.forEach(({ id: columnId }, column) => {
                const key = cellKey(rowId, columnId)
                if (!closed.has(key)) {
                    positions.set(cellDomId(key), { table, row, column })
                }
            })
        })
    })
    return positions
}

/** A text cell being typed in keeps the browser's own paste and undo; any other cell is in Ready. */
const typingIn = (target: HTMLElement) =>
    target.dataset.mode === 'enter' || target.dataset.mode === 'edit'

/** The one polite live region, saying what `announce` was given. */
const LiveRegion = () => {
    const { announcements } = useDataEntryContext()
    const text = useStore(announcements, (state) => state.text)
    return (
        <div role="status" className="sr-only">
            {text}
        </div>
    )
}

// The row header column's width; sticky group labels and scroll padding keep clear of it.
const ROW_HEADER_CLASS = 'w-48 min-w-48 max-w-48'
const BORDER_CLASS = 'border-b border-e border-dhis2-grey-300'
const HEADER_CLASS = cn(
    BORDER_CLASS,
    'bg-dhis2-grey-100 px-2 py-1.5 text-start align-bottom text-[13px] font-medium text-dhis2-grey-800'
)

const RowHeader = ({ tableId, row }: { tableId: string; row: GridRow }) => {
    const marker =
        row.status === 'COMPLETED'
            ? i18n.t('Completed')
            : row.status === 'SCHEDULE' || row.status === 'OVERDUE'
              ? i18n.t('Scheduled')
              : undefined
    return (
        <th
            scope="row"
            className={cn(
                BORDER_CLASS,
                ROW_HEADER_CLASS,
                'sticky start-0 z-10 bg-white px-2 py-1 text-start align-middle font-normal text-dhis2-grey-900 [overflow-wrap:anywhere]'
            )}
        >
            {/* Cells are named by the label alone; the marker is said once, with the row. The label sets its own
                direction, so the header keeps the table's and stays at its start. */}
            <span id={rowHeaderDomId(tableId, row.id)} dir="auto">
                {row.label}
            </span>
            {marker === undefined ? null : (
                <>
                    {' '}
                    <span className="inline-block rounded-full bg-dhis2-grey-200 px-1.5 text-xs text-dhis2-grey-800">
                        {marker}
                    </span>
                </>
            )}
        </th>
    )
}

interface TableViewProps {
    table: GridTable
    move(key: NavKey): void
    /** The table takes new rows: an "Add event" button follows it. */
    adds: boolean
    addRow(tableId: string): void
}

/** One table in its own scrolling region, its header row and first column sticky. */
const TableView = memo(function TableView({
    table,
    move,
    adds,
    addRow,
}: TableViewProps) {
    const region = useRef<HTMLDivElement>(null)
    const head = useRef<HTMLTableSectionElement>(null)
    const labels = useMemo(() => columnHeaderIds(table), [table])
    const titleId = `data-entry-${table.id}-title`
    // The rows before "Add event" was pressed; the row that then appears takes focus.
    const rowsBefore = useRef<ReadonlySet<string>>()
    useEffect(() => {
        const before = rowsBefore.current
        if (before === undefined) {
            return
        }
        const added = table.rows.find(({ id }) => !before.has(id))
        if (added === undefined) {
            return
        }
        rowsBefore.current = undefined
        const column = table.columns.find(
            ({ id }) => !table.closed.has(cellKey(added.id, id))
        )
        if (column !== undefined) {
            document
                .getElementById(cellDomId(cellKey(added.id, column.id)))
                ?.focus()
        }
    }, [table])
    // Scroll padding as tall as the sticky header, however its labels wrap, so a focused cell never sits under it.
    useLayoutEffect(() => {
        const scroller = region.current
        const header = head.current
        if (scroller === null || header === null) {
            return
        }
        const observer = new ResizeObserver(() => {
            scroller.style.scrollPaddingTop = `${header.getBoundingClientRect().height}px`
        })
        observer.observe(header)
        return () => observer.disconnect()
    }, [])
    return (
        <div className="flex flex-col gap-2">
            <p id={titleId} className="text-sm font-medium text-dhis2-grey-900">
                {table.title}
            </p>
            <div
                ref={region}
                role="region"
                aria-labelledby={titleId}
                className="max-h-[70vh] scroll-ps-48 overflow-auto rounded-dhis2-sm border border-dhis2-grey-300 bg-white"
            >
                <table
                    aria-labelledby={titleId}
                    className="border-separate border-spacing-0 text-sm"
                >
                    <thead ref={head} className="sticky top-0 z-20">
                        {table.headerRows.map((cells, level) => (
                            <tr key={level}>
                                {level === 0 ? (
                                    <td
                                        rowSpan={table.headerRows.length}
                                        className={cn(
                                            HEADER_CLASS,
                                            ROW_HEADER_CLASS,
                                            'sticky start-0 z-10'
                                        )}
                                    />
                                ) : null}
                                {cells.map(({ id, label, span }) => (
                                    <th
                                        key={id}
                                        id={headerDomId(table.id, id)}
                                        colSpan={span}
                                        scope="col"
                                        className={cn(HEADER_CLASS, 'min-w-28')}
                                    >
                                        {/* A group wider than the screen keeps its label beside the row headers. */}
                                        {span > 1 ? (
                                            <span className="sticky start-48 inline-block">
                                                {label}
                                            </span>
                                        ) : (
                                            label
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.rows.map((row) => {
                            const rowHeader = rowHeaderDomId(table.id, row.id)
                            return (
                                <tr key={row.id}>
                                    <RowHeader tableId={table.id} row={row} />
                                    {table.columns.map((column, c) => {
                                        const key = cellKey(row.id, column.id)
                                        return (
                                            <td
                                                key={column.id}
                                                className={cn(
                                                    BORDER_CLASS,
                                                    'min-w-28 p-0'
                                                )}
                                            >
                                                <Cell
                                                    cellKey={key}
                                                    field={column.field}
                                                    labelledBy={`${labels[c]} ${rowHeader}`}
                                                    move={move}
                                                    closedReason={table.closed.get(
                                                        key
                                                    )}
                                                />
                                            </td>
                                        )
                                    })}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {adds ? (
                <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    aria-describedby={titleId}
                    onClick={() => {
                        rowsBefore.current = new Set(
                            table.rows.map(({ id }) => id)
                        )
                        addRow(table.id)
                    }}
                >
                    {i18n.t('Add event')}
                </Button>
            ) : null}
        </div>
    )
})

/**
 * The form's tables (or one, by `tableId`), stacked: Enter and the arrows carry on from one table into the next,
 * Tab follows the page, a spreadsheet block pastes from the focused cell, Ctrl+Z undoes, and a skip link moves past it.
 */
export const DataGrid = ({
    tableId,
    className,
}: {
    tableId?: string
    className?: string
}) => {
    const {
        tables: all,
        store,
        effects,
        announce,
        newRowTables,
        addRow,
    } = useDataEntryContext()
    const tables = useMemo(
        () =>
            tableId === undefined
                ? all
                : all.filter(({ id }) => id === tableId),
        [all, tableId]
    )
    const grid = useMemo(() => navGrid(tables, effects), [tables, effects])
    const positions = useMemo(() => positionsOf(tables), [tables])
    const keyAt = ({ table, row, column }: CellPosition) =>
        cellKey(tables[table].rows[row].id, tables[table].columns[column].id)
    const end = useId()

    // The DOM id of the cell that has focus, or last had it.
    const focused = useRef<string>()
    // The column a run of Tabs began in; Enter returns below it (as Excel does), an arrow or a click ends the run.
    const tabStart = useRef<number>()
    const moveTo = useRef<(key: NavKey) => void>()
    moveTo.current = (key) => {
        const from = positions.get(focused.current ?? '')
        if (from === undefined) {
            return
        }
        // The browser moves focus on Tab; the grid only notes where the run began.
        if (key === 'tab') {
            tabStart.current ??= from.column
            return
        }
        const to = nextCell(grid, from, key, tabStart.current)
        tabStart.current = undefined
        if (to !== undefined) {
            document.getElementById(cellDomId(keyAt(to)))?.focus()
        }
    }
    // One function for the grid's life, so no cell re-renders for it.
    const move = useCallback((key: NavKey) => moveTo.current?.(key), [])

    // A value refused where the person is (Enter, an arrow, leaving the cell, a paste) is said aloud, once per text.
    useEffect(
        () =>
            store.subscribe((state, before) => {
                const at = positions.get(focused.current ?? '')
                if (at === undefined) {
                    return
                }
                const key = keyAt(at)
                const cell = state.cells[key]
                const was = before.cells[key]
                if (
                    cell?.error !== undefined &&
                    cell !== was &&
                    cell.draft !== was?.draft
                ) {
                    announce(i18n.t(cell.error))
                }
            }),
        // `keyAt` reads `tables`, which `positions` follows.
        [store, announce, positions]
    )

    /** The cell a Ready-mode paste or undo is for: a cell control not being typed in. */
    const readyCell = (target: EventTarget) =>
        target instanceof HTMLElement && !typingIn(target)
            ? positions.get(target.id)
            : undefined
    /** Runs a store change on the screen at once, then selects the cell's new value, as Ready shows it. */
    const changeHere = (target: EventTarget, change: () => void) => {
        flushSync(change)
        if (target instanceof HTMLInputElement) {
            target.select()
        }
    }

    const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
        const from = readyCell(event.target)
        if (from === undefined) {
            return
        }
        event.preventDefault()
        const text = event.clipboardData.getData('text/plain')
        // A single value goes the same way, so a spreadsheet's quotes around it are dropped.
        const entries = pasteTargets(grid, from, parseBlock(text)).map(
            ({ at, text: cellText }) => ({ key: keyAt(at), text: cellText })
        )
        let filled = 0
        changeHere(event.target, () => {
            filled = store
                .getState()
                .commitMany(entries)
                .filter((result) => result !== 'invalid').length
        })
        if (isBlock(text)) {
            announce(
                i18n.t('Cells pasted: {{cells}}', {
                    cells: formatCount(filled),
                })
            )
        }
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            !event.shiftKey &&
            event.key.toLowerCase() === 'z' &&
            readyCell(event.target) !== undefined
        ) {
            event.preventDefault()
            let undone: ReadonlyArray<CellKey> = []
            changeHere(event.target, () => {
                undone = store.getState().undo()
            })
            // Undo can change a cell elsewhere in the grid: focus goes there, so the change is seen and heard.
            if (undone.length > 0) {
                document.getElementById(cellDomId(undone[0]))?.focus()
            }
        }
    }

    return (
        <div
            className={cn('flex flex-col gap-4', className)}
            onFocus={(event) => {
                if (positions.has(event.target.id)) {
                    focused.current = event.target.id
                }
            }}
            onMouseDown={() => {
                tabStart.current = undefined
            }}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
        >
            <a
                href={`#${end}`}
                onClick={(event) => {
                    // Focus moves without touching the address, which some apps route by.
                    event.preventDefault()
                    document.getElementById(end)?.focus()
                }}
                className="sr-only self-start rounded-dhis2-sm bg-white px-2 py-1 text-sm text-dhis2-blue-800 underline focus:not-sr-only focus:outline-2 focus:outline-dhis2-blue-600"
            >
                {i18n.t('Skip past the grid')}
            </a>
            {tables.map((table) => (
                <TableView
                    key={table.id}
                    table={table}
                    move={move}
                    adds={newRowTables.has(table.id)}
                    addRow={addRow}
                />
            ))}
            <LiveRegion />
            <div id={end} tabIndex={-1} className="outline-none" />
        </div>
    )
}
