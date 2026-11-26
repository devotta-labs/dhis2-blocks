import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import type { FocusEvent, KeyboardEvent, PointerEvent } from 'react'
import { useStore } from 'zustand'
import { cn } from '@/components/dhis2/ui/cn'
import type { TallyIndex } from '../core/layout'
import type { TallyRow } from '../core/types'
import { useTallyContext } from './context'
import { activeCell } from './pointer'
import { TallyCell } from './TallyCell'

const NO_ROW: TallyRow = { id: '', label: '' }
const BORDER_CLASS = 'border-b border-dhis2-border'
const POINTED_CLASS = 'bg-dhis2-info-fill text-dhis2-info-strong'
const LABEL_COLUMN_CLASS =
    'w-[min(16rem,40cqi)] min-w-[min(16rem,40cqi)] max-w-[min(16rem,40cqi)]'

const cellOf = (target: EventTarget) => {
    const holder =
        target instanceof Element ? target.closest('td[data-cell]') : null
    return holder instanceof HTMLElement
        ? Number(holder.dataset.cell)
        : undefined
}

const ColumnHeader = memo(function ColumnHeader({
    id,
    label,
    span,
    at,
}: {
    id: string
    label: string
    span: number
    at: number
}) {
    const { pointer, index } = useTallyContext('TallyGrid')
    const size = index.columns.length
    const pointed = useStore(pointer.headings, (state) => {
        const cell = activeCell(state)
        return cell !== undefined && Math.floor((cell % size) / span) === at
    })
    return (
        <th
            scope="col"
            colSpan={span}
            className={cn(
                BORDER_CLASS,
                'bg-dhis2-muted px-2 py-1.5 text-center align-bottom text-xs font-medium text-dhis2-muted-foreground',
                span === 1 && 'min-w-[4.5rem]',
                pointed && POINTED_CLASS
            )}
        >
            <span id={id} dir="auto">
                {label}
            </span>
        </th>
    )
})

const RowBadgeSlot = ({ row, at }: { row: TallyRow; at: number }) => {
    const { store, RowBadge } = useTallyContext('TallyGrid')
    const total = useStore(store, (state) => state.rowTotals[at] ?? 0)
    return RowBadge === undefined ? null : <RowBadge row={row} total={total} />
}

const RowHeader = memo(function RowHeader({
    row,
    at,
}: {
    row: TallyRow
    at: number
}) {
    const { pointer, index, ids, RowBadge } = useTallyContext('TallyGrid')
    const size = index.columns.length
    const pointed = useStore(pointer.headings, (state) => {
        const cell = activeCell(state)
        return cell !== undefined && Math.floor(cell / size) === at
    })
    return (
        <th
            scope="row"
            className={cn(
                BORDER_CLASS,
                LABEL_COLUMN_CLASS,
                'sticky start-0 z-10 bg-dhis2-background px-2 py-1 text-start align-middle text-sm font-normal text-dhis2-foreground [overflow-wrap:anywhere]',
                pointed && POINTED_CLASS
            )}
        >
            <span className="flex flex-wrap items-center gap-2">
                <span id={ids.row(at)} dir="auto">
                    {row.label}
                </span>
                {RowBadge === undefined ? null : (
                    <RowBadgeSlot row={row} at={at} />
                )}
            </span>
        </th>
    )
})

const firstOpenIn = (index: TallyIndex, cells: readonly number[]) =>
    cells.find((cell) => !index.isClosed(cell))

const rowCells = (index: TallyIndex, row: number) =>
    index.columns.map((_, column) => row * index.columns.length + column)

const tallyTarget = (
    index: TallyIndex,
    order: readonly number[],
    cell: number,
    event: KeyboardEvent,
    rtl: boolean
) => {
    const size = index.columns.length
    const row = Math.floor(cell / size)
    const column = cell % size
    const place = order.indexOf(row)
    const across = (step: number) =>
        firstOpenIn(
            index,
            rowCells(index, row)
                .filter((other) => (step > 0 ? other > cell : other < cell))
                .sort((a, b) => (a - b) * step)
        )
    const down = (step: number) =>
        firstOpenIn(
            index,
            (step > 0
                ? order.slice(place + 1)
                : order.slice(0, place).reverse()
            ).map((other) => other * size + column)
        )
    const everyCell = order.flatMap((other) => rowCells(index, other))
    switch (event.key) {
        case 'ArrowRight':
            return across(rtl ? -1 : 1)
        case 'ArrowLeft':
            return across(rtl ? 1 : -1)
        case 'ArrowDown':
            return down(1)
        case 'ArrowUp':
            return down(-1)
        case 'Home':
            return firstOpenIn(
                index,
                event.ctrlKey ? everyCell : rowCells(index, row)
            )
        case 'End':
            return firstOpenIn(
                index,
                (event.ctrlKey ? everyCell : rowCells(index, row)).reverse()
            )
        default:
            return undefined
    }
}

const editStep = (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp') return -1
    if (event.key === 'ArrowDown') return 1
    if (event.key === 'Enter') return event.shiftKey ? -1 : 1
    return 0
}

const MOVES = new Set([
    'ArrowRight',
    'ArrowLeft',
    'ArrowDown',
    'ArrowUp',
    'Home',
    'End',
])

/**
 * The sheet's grid: a header row per category, a row per row of the layout under its group's heading, and a count
 * button in each open cell. Arrow keys move between open cells; Home and End to the row's ends, with Ctrl the sheet's.
 */
export const TallyGrid = memo(function TallyGrid({
    className,
}: {
    className?: string
}) {
    const { index, levels, sections, ids, label, pointer } =
        useTallyContext('TallyGrid')
    const region = useRef<HTMLDivElement>(null)
    const head = useRef<HTMLTableSectionElement>(null)
    const order = useMemo(
        () => sections.flatMap(({ rows }) => rows),
        [sections]
    )
    const size = index.columns.length
    const firstOpen = useMemo(
        () =>
            firstOpenIn(
                index,
                order.flatMap((row) => rowCells(index, row))
            ),
        [index, order]
    )

    useLayoutEffect(() => {
        const scroller = region.current
        if (scroller === null) return
        const header = head.current
        const rowHeader = scroller.querySelector('th[scope="row"]')
        const observer = new ResizeObserver(() => {
            const top = header?.getBoundingClientRect().height ?? 0
            const start = rowHeader?.getBoundingClientRect().width ?? 0
            scroller.style.scrollPaddingTop = `${top}px`
            scroller.style.scrollPaddingInlineStart = `${start}px`
        })
        for (const watched of [header, rowHeader]) {
            if (watched) observer.observe(watched)
        }
        return () => observer.disconnect()
    }, [])

    const focusCell = (cell: number | undefined) => {
        if (cell === undefined) return
        document.getElementById(ids.cell(cell))?.focus()
    }

    const editTarget = (cell: number, step: number) => {
        const column = cell % size
        const place = order.indexOf(Math.floor(cell / size))
        const rows =
            step > 0 ? order.slice(place + 1) : order.slice(0, place).reverse()
        return rows
            .map((row) => row * size + column)
            .find(
                (other) =>
                    document.getElementById(ids.cell(other)) instanceof
                    HTMLInputElement
            )
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const cell = cellOf(event.target)
        if (cell === undefined || event.altKey || event.metaKey) return
        if (event.target instanceof HTMLInputElement) {
            const step = editStep(event)
            if (step === 0) return
            event.preventDefault()
            focusCell(editTarget(cell, step))
            return
        }
        if (!MOVES.has(event.key) || event.shiftKey) return
        event.preventDefault()
        const table = region.current?.querySelector('table')
        const rtl =
            table instanceof HTMLTableElement &&
            getComputedStyle(table).direction === 'rtl'
        focusCell(tallyTarget(index, order, cell, event, rtl))
    }

    const onFocus = (event: FocusEvent<HTMLDivElement>) => {
        const cell = cellOf(event.target)
        if (cell === undefined) return
        pointer.headings.setState({ focused: cell })
        if (event.target instanceof HTMLElement) {
            event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
        if (event.target instanceof HTMLInputElement) {
            pointer.tabStop.setState({ field: cell })
        }
        if (!index.isClosed(cell)) pointer.tabStop.setState({ tabStop: cell })
    }

    const onPointerOver = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== 'mouse') return
        const cell = cellOf(event.target)
        if (pointer.headings.getState().pointed !== cell) {
            pointer.headings.setState({ pointed: cell })
        }
    }

    return (
        // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- moves focus between the cells and highlights their headings; the cells are the controls
        <div
            data-slot="tally-grid"
            className={cn('min-w-0', className)}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={() => pointer.headings.setState({ focused: undefined })}
            onPointerOver={onPointerOver}
            onPointerLeave={() =>
                pointer.headings.setState({ pointed: undefined })
            }
        >
            <div
                ref={region}
                role="region"
                aria-label={label}
                data-slot="tally-scroll"
                className="@container isolate max-h-[70vh] w-full overflow-auto [overflow-anchor:none] rounded-dhis2-sm border border-dhis2-border bg-dhis2-background"
            >
                <table
                    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- the ARIA grid pattern on a table: arrow keys move between cells
                    role="grid"
                    aria-label={label}
                    className="w-full border-separate border-spacing-0"
                >
                    {levels.length === 0 ? null : (
                        <thead ref={head} className="sticky top-0 z-20">
                            {levels.map(({ span, headers }, level) => (
                                <tr key={level}>
                                    {level === 0 ? (
                                        <td
                                            rowSpan={levels.length}
                                            className={cn(
                                                BORDER_CLASS,
                                                LABEL_COLUMN_CLASS,
                                                'sticky start-0 z-10 bg-dhis2-muted'
                                            )}
                                        />
                                    ) : null}
                                    {headers.map(({ id, label: name }, at) => (
                                        <ColumnHeader
                                            key={`${id}-${at}`}
                                            id={ids.column(level, at)}
                                            label={name}
                                            span={span}
                                            at={at}
                                        />
                                    ))}
                                </tr>
                            ))}
                        </thead>
                    )}
                    {sections.map(({ group, rows }, at) => (
                        <tbody key={group ?? `rows-${at}`}>
                            {group === undefined ? null : (
                                <tr>
                                    <th
                                        id={ids.group(at)}
                                        scope="rowgroup"
                                        colSpan={size + 1}
                                        className={cn(
                                            BORDER_CLASS,
                                            'bg-dhis2-background-subtle px-2 pt-3 pb-1 text-start text-sm font-medium text-dhis2-foreground'
                                        )}
                                    >
                                        <span
                                            dir="auto"
                                            className="sticky start-2 inline-block"
                                        >
                                            {group}
                                        </span>
                                    </th>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr key={index.rows[row]?.id ?? row}>
                                    <RowHeader
                                        row={index.rows[row] ?? NO_ROW}
                                        at={row}
                                    />
                                    {rowCells(index, row).map((cell) => (
                                        <TallyCell
                                            key={cell}
                                            cell={cell}
                                            firstOpen={cell === firstOpen}
                                        />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    ))}
                </table>
            </div>
        </div>
    )
})
