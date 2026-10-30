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
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { Kbd } from '@/components/dhis2/ui/kbd'
import { replacementFor, RowCell } from '../cells/Cell'
import { cellDomId } from '../cells/cellProps'
import type { CellOverrides } from '../cells/cellProps'
import { formatCount } from '../cells/OptionCell'
import { takesPastedText } from '../cells/popupEditors'
import { addsRow } from '../cells/useCellMode'
import type { CellMessage, MessageKind } from '../logic/effects'
import { cellKey } from '../model/types'
import type { CellKey, GridRow, GridTable } from '../model/types'
import { useDataEntryContext, useRowCells } from '../provider/context'
import type { EffectsState } from '../provider/context'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import {
    columnHeaderIds,
    headerDomId,
    rowHeaderDomId,
    rowLabel,
} from './headers'
import { nextCell } from './navigation'
import type { CellPosition, NavGrid, NavKey } from './navigation'
import { isBlock, pastedBlock, pasteTargets } from './paste'
import { ShowMoreEvents } from './ShowMoreEvents'
import { useAddRow } from './useAddRow'

/** What `nextCell` and `pasteTargets` walk; each lookup is a map read, as they ask once per cell stepped over. */
const navGrid = (
    tables: ReadonlyArray<GridTable>,
    effects: StoreApi<EffectsState>,
    overrides: CellOverrides | undefined
): NavGrid => ({
    tables: tables.map(({ rows, columns, closed }) => {
        const keyAt = (row: number, column: number) =>
            cellKey(rows[row].id, columns[column].id)
        // Read-only kinds, pop-up kinds without an editor, pop-up kinds whose text does not parse (files) and usernames
        // are never pasted into, unless a replacement edits them.
        const elsewhere = columns.map(
            ({ id, field }) =>
                !takesPastedText(field) &&
                replacementFor(overrides, id, field) === undefined
        )
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
const positionsOf = (idScope: string, tables: ReadonlyArray<GridTable>) => {
    const positions = new Map<string, CellPosition>()
    tables.forEach(({ rows, columns, closed }, table) => {
        rows.forEach(({ id: rowId }, row) => {
            columns.forEach(({ id: columnId }, column) => {
                const key = cellKey(rowId, columnId)
                if (!closed.has(key)) {
                    positions.set(cellDomId(idScope, key), {
                        table,
                        row,
                        column,
                    })
                }
            })
        })
    })
    return positions
}

// The row header column's width, at most 30% of the screen so the page reflows when zoomed; sticky group labels and
// scroll padding keep clear of it.
const ROW_HEADER_CLASS =
    'w-[min(12rem,30vw)] min-w-[min(12rem,30vw)] max-w-[min(12rem,30vw)]'
const BORDER_CLASS = 'border-b border-e border-dhis2-grey-300'
// A fixed height, a minimum in a table, lets the cell's control fill the row however tall the row header makes it.
const CELL_CLASS = cn(BORDER_CLASS, 'h-9 min-w-28 p-0')
const HEADER_CLASS = cn(
    BORDER_CLASS,
    'bg-dhis2-grey-100 px-2 py-1.5 text-start align-bottom text-[13px] font-medium text-dhis2-grey-800'
)

const NO_NOTES: ReadonlyArray<string> = []
const NO_MESSAGES: ReadonlyArray<CellMessage> = []

// Marked as a cell's notes are, on the header's light background.
const MESSAGE_TONES = {
    error: 'border-dhis2-red-600',
    errorOnComplete: 'border-dhis2-red-600',
    warning: 'border-dhis2-yellow-700',
    warningOnComplete: 'border-dhis2-yellow-700',
} satisfies Record<MessageKind, string>

const RowHeader = memo(function RowHeader({
    idScope,
    tableId,
    row,
}: {
    idScope: string
    tableId: string
    row: GridRow
}) {
    const { effects, store, settings } = useDataEntryContext()
    const notes = useStore(
        effects,
        (state) => state.rowNotes.get(row.id) ?? NO_NOTES
    )
    const messages = useStore(
        effects,
        (state) => state.rowMessages.get(row.id) ?? NO_MESSAGES
    )
    const date = useStore(
        store,
        (state) => state.cells[cellKey(row.id, EVENT_DATE_COLUMN)]?.value
    )
    const scheduled =
        row.status === 'SCHEDULE' || row.status === 'OVERDUE'
            ? i18n.t('Scheduled')
            : undefined
    const marker = row.status === 'COMPLETED' ? i18n.t('Completed') : scheduled
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
            <span id={rowHeaderDomId(idScope, tableId, row.id)} dir="auto">
                {rowLabel(row, date, settings)}
            </span>
            {marker === undefined ? null : (
                <>
                    {' '}
                    <span className="inline-block rounded-full bg-dhis2-grey-200 px-1.5 text-xs text-dhis2-grey-800">
                        {marker}
                    </span>
                </>
            )}
            {notes.map((note, i) => (
                <span
                    key={i}
                    dir="auto"
                    className="block text-xs text-dhis2-grey-700"
                >
                    {note}
                </span>
            ))}
            {/* What the row's rules, or their failure, say without a field. */}
            {messages.length > 0 ? (
                <ul className="mt-0.5 flex flex-col gap-0.5">
                    {messages.map(({ kind, text }, i) => (
                        <li
                            key={i}
                            dir="auto"
                            className={cn(
                                'border-s-2 ps-1.5 text-xs text-dhis2-grey-900',
                                MESSAGE_TONES[kind]
                            )}
                        >
                            {text}
                        </li>
                    ))}
                </ul>
            ) : null}
        </th>
    )
})

interface TableRowProps {
    idScope: string
    table: GridTable
    row: GridRow
    /** The ids of the column headers that name each column's cells. */
    labels: ReadonlyArray<string>
    move(key: NavKey): void
}

/** One row of a table: it reads its cells' states and effects, once for the row, and hands each cell its own. */
const TableRow = memo(function TableRow({
    idScope,
    table,
    row,
    labels,
    move,
}: TableRowProps) {
    const keys = table.columns.map(({ id }) => cellKey(row.id, id))
    const { states, effects } = useRowCells(keys)
    const rowHeader = rowHeaderDomId(idScope, table.id, row.id)
    return (
        <tr>
            <RowHeader idScope={idScope} tableId={table.id} row={row} />
            {table.columns.map((column, c) => (
                <td key={column.id} className={CELL_CLASS}>
                    <RowCell
                        cellKey={keys[c]}
                        field={column.field}
                        labelledBy={`${labels[c]} ${rowHeader}`}
                        move={move}
                        closedReason={table.closed.get(keys[c])}
                        cell={states[c]}
                        effects={effects[c]}
                    />
                </td>
            ))}
        </tr>
    )
})

interface TableViewProps {
    idScope: string
    table: GridTable
    move(key: NavKey): void
    /** The table takes new rows: an "Add event" button follows it. */
    adds: boolean
    /** Adds a row to the table and focuses its first open cell. */
    addRow(tableId: string): void
}

/** One table in its own scrolling region, its header row and first column sticky. */
const TableView = memo(function TableView({
    idScope,
    table,
    move,
    adds,
    addRow,
}: TableViewProps) {
    const region = useRef<HTMLDivElement>(null)
    const head = useRef<HTMLTableSectionElement>(null)
    const labels = useMemo(
        () => columnHeaderIds(idScope, table),
        [idScope, table]
    )
    const titleId = `${idScope}-${table.id}-title`
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
                className="max-h-[70vh] scroll-ps-[min(12rem,30vw)] overflow-auto rounded-dhis2-sm border border-dhis2-grey-300 bg-white"
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
                                        id={headerDomId(idScope, table.id, id)}
                                        colSpan={span}
                                        scope="col"
                                        className={cn(HEADER_CLASS, 'min-w-28')}
                                    >
                                        {/* A group wider than the screen keeps its label beside the row headers. */}
                                        {span > 1 ? (
                                            <span className="sticky start-[min(12rem,30vw)] inline-block">
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
                        {table.rows.map((row) => (
                            <TableRow
                                key={row.id}
                                idScope={idScope}
                                table={table}
                                row={row}
                                labels={labels}
                                move={move}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            {adds ? (
                <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 self-start pe-1"
                    aria-describedby={titleId}
                    aria-keyshortcuts="Control+Enter Meta+Enter"
                    onClick={() => addRow(table.id)}
                >
                    {i18n.t('Add event')}
                    {/* Screen readers hear the shortcut from aria-keyshortcuts; the button keeps its name. */}
                    <Kbd aria-hidden>
                        {/* Apple keyboards say ⌘ where others say Ctrl. */}
                        {/Mac|iPhone|iPad/.test(navigator.platform)
                            ? '⌘↵'
                            : i18n.t('Ctrl ↵')}
                    </Kbd>
                </Button>
            ) : null}
        </div>
    )
})

/**
 * The form's tables (or one, by `tableId`), stacked: Enter and the arrows carry on from one table into the next,
 * Tab follows the page, a spreadsheet block pastes from the focused cell, Ctrl+Z undoes, Ctrl+Enter adds a row to the
 * cell's table, and a skip link moves past it.
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
        idScope,
        overrides,
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
    const grid = useMemo(
        () => navGrid(tables, effects, overrides),
        [tables, effects, overrides]
    )
    const positions = useMemo(
        () => positionsOf(idScope, tables),
        [idScope, tables]
    )
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
        // Left and Right go the way they point: in a right-to-left table the next column is on the left.
        const table = document
            .getElementById(focused.current ?? '')
            ?.closest('table')
        const flipped =
            (key === 'left' || key === 'right') &&
            table instanceof HTMLTableElement &&
            getComputedStyle(table).direction === 'rtl'
        const mirrored = key === 'left' ? 'right' : 'left'
        const to = nextCell(
            grid,
            from,
            flipped ? mirrored : key,
            tabStart.current
        )
        tabStart.current = undefined
        if (to !== undefined) {
            document.getElementById(cellDomId(idScope, keyAt(to)))?.focus()
        }
    }
    // One function for the grid's life, so no cell re-renders for it.
    const move = useCallback((key: NavKey) => moveTo.current?.(key), [])

    const add = useAddRow(idScope, tables, addRow)

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
                    announce(cell.error)
                }
            }),
        // `keyAt` reads `tables`, which `positions` follows.
        [store, announce, positions]
    )

    /** The cell a Ready-mode paste or undo is for: a default control in Ready. A replacement keeps its own. */
    const readyCell = (target: EventTarget) =>
        target instanceof HTMLElement && target.dataset.mode === 'ready'
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
        const longText =
            tables[from.table].columns[from.column].field.valueType ===
            'LONG_TEXT'
        const entries = pasteTargets(
            grid,
            from,
            pastedBlock(text, longText)
        ).map(({ at, text: cellText }) => ({
            key: keyAt(at),
            text: cellText,
        }))
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
                    nsSeparator: '::',
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
                document.getElementById(cellDomId(idScope, undone[0]))?.focus()
            }
        }
        // A cell that saved the typing lets the key through; one that kept the text, or an editor, stops it.
        const at =
            event.target instanceof HTMLElement
                ? positions.get(event.target.id)
                : undefined
        if (addsRow(event) && !event.defaultPrevented && at !== undefined) {
            const { id } = tables[at.table]
            if (newRowTables.has(id)) {
                event.preventDefault()
                add(id)
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
                    idScope={idScope}
                    table={table}
                    move={move}
                    adds={newRowTables.has(table.id)}
                    addRow={add}
                />
            ))}
            <div id={end} tabIndex={-1} className="outline-none" />
            <ShowMoreEvents end={end} />
        </div>
    )
}
