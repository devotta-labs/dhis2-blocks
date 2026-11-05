import { memo } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/components/dhis2/ui/cn'
import type { CellMessage, Tone } from '../model/annotations'
import type { CellKey, GridRow } from '../model/types'
import { useSpreadsheetContext } from '../provider/context'
import { nameFrom, rowHeaderDomId } from './headers'

// The row header column's width, at most 30% of the screen so the page reflows when zoomed; sticky group labels and
// scroll padding keep clear of it.
export const ROW_HEADER_CLASS =
    'w-[min(12rem,30vw)] min-w-[min(12rem,30vw)] max-w-[min(12rem,30vw)]'
export const BORDER_CLASS = 'border-b border-e border-dhis2-grey-300'

const NO_KEYS: ReadonlyArray<CellKey> = []
const NO_NOTES: ReadonlyArray<string> = []
const NO_MESSAGES: ReadonlyArray<CellMessage> = []

// Marked as a cell's notes are, on the header's light background.
const MESSAGE_TONES = {
    error: 'border-dhis2-red-600',
    warning: 'border-dhis2-yellow-700',
} satisfies Record<Tone, string>

/** A row's name as it changes: its label cells' values (`labelFrom`), each as its field shows it, else its label. */
const CellsLabel = ({ row }: { row: GridRow }) => {
    const { store, settings } = useSpreadsheetContext()
    const labelFrom = row.labelFrom ?? NO_KEYS
    const named = useStore(
        store,
        useShallow((state) => labelFrom.map((key) => state.cells[key]?.value))
    )
    return (
        <>
            {nameFrom(labelFrom, named, store.getState().fieldOf, settings) ||
                row.label}
        </>
    )
}

/** A row's name, with its badge, the source's and the rules' notes on it, and the rules' messages without a field. */
export const RowHeader = memo(function RowHeader({
    idScope,
    tableId,
    row,
}: {
    idScope: string
    tableId: string
    row: GridRow
}) {
    const {
        effects,
        rowKeysOf,
        RowLabel = CellsLabel,
        RowBadge,
    } = useSpreadsheetContext()
    // Every key the row's notes and messages are under: a register's row shows what the rules say of each of its
    // events, once, as a program's rule says the same of every event it runs on.
    const notes = useStore(
        effects,
        useShallow((state) => [
            ...new Set(
                rowKeysOf(row).flatMap(
                    (id) => state.rowNotes.get(id) ?? NO_NOTES
                )
            ),
        ])
    )
    const messages = useStore(
        effects,
        useShallow((state) =>
            rowKeysOf(row)
                .flatMap((id) => state.rowMessages.get(id) ?? NO_MESSAGES)
                .filter(
                    (message, at, all) =>
                        all.findIndex(
                            ({ tone, text }) =>
                                tone === message.tone && text === message.text
                        ) === at
                )
        )
    )
    return (
        <th
            scope="row"
            className={cn(
                BORDER_CLASS,
                ROW_HEADER_CLASS,
                'sticky start-0 z-10 bg-white px-2 py-1 text-start align-middle font-normal text-dhis2-grey-900 [overflow-wrap:anywhere]'
            )}
        >
            {/* Cells are named by the label alone; the badge is said once, with the row. The label sets its own
                direction, so the header keeps the table's and stays at its start. */}
            <span id={rowHeaderDomId(idScope, tableId, row.id)} dir="auto">
                <RowLabel row={row} />
            </span>
            {RowBadge === undefined ? null : <RowBadge rowId={row.id} />}
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
                    {messages.map(({ tone, text }, i) => (
                        <li
                            key={i}
                            dir="auto"
                            className={cn(
                                'border-s-2 ps-1.5 text-xs text-dhis2-grey-900',
                                MESSAGE_TONES[tone]
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
