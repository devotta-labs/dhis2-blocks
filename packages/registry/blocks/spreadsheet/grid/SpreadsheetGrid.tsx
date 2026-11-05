import i18n from '@dhis2/d2-i18n'
import {
    memo,
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import type { ClipboardEvent, KeyboardEvent, SyntheticEvent } from 'react'
import { flushSync } from 'react-dom'
import { useStore } from 'zustand'
import { cn } from '@/components/dhis2/ui/cn'
import { cellDomId } from '../cells/cellProps'
import { formatCount } from '../cells/OptionCell'
import { addsRow } from '../cells/useCellMode'
import type { CellKey, CellPlace, GridColumn, GridTable } from '../model/types'
import { useSpreadsheetContext } from '../provider/context'
import { AddRowButton } from './AddRowButton'
import {
    ACTIONS_CLASS,
    ActionsButton,
    BulkMenu,
    opensMenu,
    takesColumnActions,
    useBulkConfirm,
} from './BulkMenu'
import type { BulkTarget } from './BulkMenu'
import { changedBy } from './bulk'
import { columnHeaderIds, headerDomId } from './headers'
import { nextCell } from './navigation'
import type { NavKey } from './navigation'
import { fillDown } from './fillDown'
import { fieldAt, navGrid, positionsOf, reasonOf } from './navGrid'
import { isBlock, pastedBlock, pasteTargets } from './paste'
import { BORDER_CLASS, ROW_HEADER_CLASS } from './RowHeader'
import { NotesPopover } from './RowNotes'
import type { NotesTarget } from './RowNotes'
import { TableBody } from './TableBody'
import { LAST_CLASS } from './TableRow'
import { useAddRow } from './useAddRow'

const HEADER_CLASS = cn(
    BORDER_CLASS,
    'bg-dhis2-grey-100 px-2 py-1.5 text-start align-bottom text-[13px] font-medium text-dhis2-grey-800'
)

interface TableViewProps {
    idScope: string
    table: GridTable
    move(key: NavKey): void
    /** The table takes new rows: a button with this label follows it. */
    addLabel?: string
    /** Adds a row to the table and focuses its first open cell. */
    addRow(tableId: string): void
    openMenu(target: BulkTarget): void
    openNotes(target: NotesTarget): void
    /** A row to draw wherever the region has scrolled, for a cell about to get focus. */
    reveal?: number
}

/** One table in its own scrolling region, its header row and first column sticky. */
const TableView = memo(function TableView({
    idScope,
    table,
    move,
    addLabel,
    addRow,
    openMenu,
    openNotes,
    reveal,
}: TableViewProps) {
    const context = useSpreadsheetContext()
    const region = useRef<HTMLDivElement>(null)
    const head = useRef<HTMLTableSectionElement>(null)
    const labels = useMemo(
        () => columnHeaderIds(idScope, table),
        [idScope, table]
    )
    // The column each leaf heading names, for the columns that take column actions.
    const bulkLeaves = useMemo(
        () =>
            new Map(
                table.columns.flatMap(
                    (column, c): Array<[string, GridColumn]> =>
                        takesColumnActions(context, table, column)
                            ? [[labels[c].split(' ').at(-1) ?? '', column]]
                            : []
                )
            ),
        [context, table, labels]
    )
    const titleId = `${idScope}-${table.id}-title`
    const [headerHeight, setHeaderHeight] = useState(0)
    // Scroll padding as tall as the sticky header, however its labels wrap, so a focused cell never sits under it.
    useLayoutEffect(() => {
        const scroller = region.current
        const header = head.current
        if (scroller === null || header === null) {
            return
        }
        const observer = new ResizeObserver(() => {
            const { height } = header.getBoundingClientRect()
            scroller.style.scrollPaddingTop = `${height}px`
            setHeaderHeight(height)
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
                className="isolate w-fit max-w-full max-h-[70vh] scroll-ps-[min(12rem,30vw)] scroll-pe-9 overflow-auto [overflow-anchor:none] rounded-dhis2-sm border border-dhis2-grey-300 bg-white"
            >
                {/* Only the rows near the view are drawn: the row count and each row's index say where they sit. */}
                <table
                    aria-labelledby={titleId}
                    aria-rowcount={table.headerRows.length + table.rows.length}
                    className="border-separate border-spacing-0 text-sm"
                >
                    <thead ref={head} className="sticky top-0 z-20">
                        {table.headerRows.map((cells, level) => (
                            <tr key={level} aria-rowindex={level + 1}>
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
                                {cells.map(({ id, label, span, rowSpan }) => {
                                    // The label alone names the cells; a button in the heading is not part of it.
                                    const labelId = headerDomId(
                                        idScope,
                                        table.id,
                                        id
                                    )
                                    const column =
                                        span === 1
                                            ? bulkLeaves.get(labelId)
                                            : undefined
                                    return (
                                        <th
                                            key={id}
                                            colSpan={span}
                                            rowSpan={rowSpan}
                                            scope="col"
                                            className={cn(
                                                HEADER_CLASS,
                                                'min-w-28',
                                                labels
                                                    .at(-1)
                                                    ?.split(' ')
                                                    .includes(labelId) &&
                                                    LAST_CLASS
                                            )}
                                        >
                                            {/* A group wider than the screen keeps its label beside the row headers. */}
                                            {span > 1 ? (
                                                <span
                                                    id={labelId}
                                                    className="sticky start-[min(12rem,30vw)] inline-block"
                                                >
                                                    {label}
                                                </span>
                                            ) : (
                                                <span className="flex items-end justify-between gap-1">
                                                    <span id={labelId}>
                                                        {label}
                                                    </span>
                                                    {column ===
                                                    undefined ? null : (
                                                        <ActionsButton
                                                            id={`${labelId}-actions`}
                                                            label={i18n.t(
                                                                'Column actions'
                                                            )}
                                                            labelledBy={labelId}
                                                            onOpen={(anchor) =>
                                                                openMenu({
                                                                    anchor,
                                                                    table,
                                                                    column,
                                                                })
                                                            }
                                                        />
                                                    )}
                                                </span>
                                            )}
                                        </th>
                                    )
                                })}
                                {level === 0 ? (
                                    <td
                                        rowSpan={table.headerRows.length}
                                        className={cn(
                                            HEADER_CLASS,
                                            ACTIONS_CLASS
                                        )}
                                    />
                                ) : null}
                            </tr>
                        ))}
                    </thead>
                    <TableBody
                        idScope={idScope}
                        table={table}
                        labels={labels}
                        move={move}
                        openMenu={openMenu}
                        openNotes={openNotes}
                        region={region}
                        headerHeight={headerHeight}
                        reveal={reveal}
                    />
                </table>
            </div>
            {addLabel === undefined ? null : (
                <AddRowButton
                    label={addLabel}
                    describedBy={titleId}
                    onClick={() => addRow(table.id)}
                />
            )}
        </div>
    )
})

/**
 * The form's tables (or one, by `tableId`), stacked: Enter and the arrows carry on from one table into the next,
 * Tab follows the page, a spreadsheet block pastes from the focused cell, Ctrl+Z undoes, Ctrl+Enter adds a row to the
 * cell's table, and a skip link moves past it, to just before the provider's `GridFooter`.
 */
export const SpreadsheetGrid = ({
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
        addRow,
        keyOf,
        settings,
        GridFooter,
        focusCell,
        focusing,
    } = useSpreadsheetContext()
    const tables = useMemo(
        () =>
            tableId === undefined
                ? all
                : all.filter(({ id }) => id === tableId),
        [all, tableId]
    )
    const grid = useMemo(
        () => navGrid(tables, store, effects, overrides, keyOf),
        [tables, store, effects, overrides, keyOf]
    )
    const positions = useMemo(
        () => positionsOf(idScope, tables, keyOf),
        [idScope, tables, keyOf]
    )
    const keyAt = ({ table, row, column }: CellPlace) =>
        keyOf(tables[table].rows[row], tables[table].columns[column])
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
            focusCell(keyAt(to))
        }
    }
    // One function for the grid's life, so no cell re-renders for it.
    const move = useCallback((key: NavKey) => moveTo.current?.(key), [])

    const add = useAddRow(focusCell, tables, addRow, keyOf)

    // A cell `focusCell` waits on: its row is drawn, then it gets focus.
    const waiting = useStore(focusing, (state) => state.key)
    const reveal =
        waiting === undefined
            ? undefined
            : positions.get(cellDomId(idScope, waiting))
    useLayoutEffect(() => {
        const cell =
            waiting === undefined
                ? null
                : document.getElementById(cellDomId(idScope, waiting))
        if (cell !== null) {
            cell.focus()
            focusing.setState({ key: undefined })
        }
    }, [waiting, idScope, focusing])
    const { ask, dialog } = useBulkConfirm()

    // The one menu of row and column actions, kept after it closes so it closes in place.
    const [menu, setMenu] = useState<BulkTarget & { open: boolean }>()
    const openMenu = useCallback(
        (target: BulkTarget) => setMenu({ ...target, open: true }),
        []
    )
    // The one popover of a row's notes, kept the same way.
    const [notes, setNotes] = useState<NotesTarget & { open: boolean }>()
    const openNotes = useCallback(
        (target: NotesTarget) => setNotes({ ...target, open: true }),
        []
    )

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
        // `keyAt` reads `tables` and `keyOf`, which `positions` follows.
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

    /** Opens the grid's menu on a ready cell, its row's and its column's actions; an editor keeps the browser's. */
    const cellMenu = (event: SyntheticEvent) => {
        const at = readyCell(event.target)
        if (at === undefined || !(event.target instanceof HTMLElement)) {
            return
        }
        event.preventDefault()
        const table = tables[at.table]
        openMenu({
            anchor: event.target,
            table,
            row: table.rows[at.row],
            column: table.columns[at.column],
        })
    }

    const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
        const from = readyCell(event.target)
        const { target } = event
        if (from === undefined || !(target instanceof HTMLElement)) {
            return
        }
        event.preventDefault()
        const text = event.clipboardData.getData('text/plain')
        const longText =
            fieldAt(store.getState(), keyAt(from)).valueType === 'LONG_TEXT'
        const entries = pasteTargets(
            grid,
            from,
            pastedBlock(text, longText)
        ).map(({ at, text: cellText }) => ({
            key: keyAt(at),
            text: cellText,
        }))
        const write = () => {
            let filled = 0
            changeHere(target, () => {
                const before = store.getState()
                const results = before.commitMany(entries)
                const { cells } = store.getState()
                filled = results.filter((result, i) =>
                    changedBy(
                        result,
                        before.cells[entries[i].key],
                        cells[entries[i].key]
                    )
                ).length
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
        if (entries.length > 1) {
            ask(
                entries.map(({ key }) => key),
                target,
                write
            )
        } else {
            write()
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
                focusCell(undone[0])
            }
        }
        if (
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            !event.shiftKey &&
            event.key.toLowerCase() === 'd'
        ) {
            const here = readyCell(event.target)
            if (here !== undefined) {
                event.preventDefault()
                const key = keyAt(here)
                const above =
                    here.row === 0
                        ? undefined
                        : keyAt({ ...here, row: here.row - 1 })
                const { closed } = tables[here.table]
                const result = fillDown(
                    store.getState(),
                    effects.getState(),
                    closed,
                    settings,
                    key,
                    above,
                    reasonOf(closed, store, effects, overrides)(key)
                )
                if ('say' in result) {
                    announce(result.say)
                } else {
                    changeHere(event.target, () =>
                        store.getState().commit(key, result.commit)
                    )
                }
            }
        }
        if (opensMenu(event)) {
            cellMenu(event)
        }
        // A cell that saved the typing lets the key through; one that kept the text, or an editor, stops it.
        const at =
            event.target instanceof HTMLElement
                ? positions.get(event.target.id)
                : undefined
        if (addsRow(event) && !event.defaultPrevented && at !== undefined) {
            const { id } = tables[at.table]
            if (addRow?.has(id)) {
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
            onContextMenu={cellMenu}
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
            {tables.map((table, t) => (
                <TableView
                    key={table.id}
                    idScope={idScope}
                    table={table}
                    move={move}
                    addLabel={addRow?.get(table.id)?.label}
                    addRow={add}
                    openMenu={openMenu}
                    openNotes={openNotes}
                    reveal={reveal?.table === t ? reveal.row : undefined}
                />
            ))}
            <BulkMenu
                target={menu}
                open={menu?.open ?? false}
                onClose={() =>
                    setMenu((open) => open && { ...open, open: false })
                }
                changeHere={changeHere}
                ask={ask}
            />
            {dialog}
            <NotesPopover
                target={notes}
                onClose={() =>
                    setNotes((open) => open && { ...open, open: false })
                }
            />
            <div id={end} tabIndex={-1} className="outline-none" />
            {GridFooter === undefined ? null : (
                <GridFooter skipTargetId={end} />
            )}
        </div>
    )
}
