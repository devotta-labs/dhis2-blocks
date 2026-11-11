import { memo } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/components/dhis2/ui/cn'
import type { AnnotationsState, CellMessage, Tone } from '../model/annotations'
import type { CellKey, GridRow } from '../model/types'
import { useSpreadsheetStableContext } from '../provider/context'
import type { CellStoreState } from '../store/store'
import { nameFrom, rowHeaderDomId } from './headers'
import { NotesMarker, notesDomId, useRowNotes } from './RowNotes'
import type { NotesTarget } from './RowNotes'

// The row header column's width, at most 30% of the screen so the page reflows when zoomed; sticky group labels and
// scroll padding keep clear of it.
export const ROW_HEADER_CLASS =
    'w-[min(12rem,30vw)] min-w-[min(12rem,30vw)] max-w-[min(12rem,30vw)]'
export const BORDER_CLASS = 'border-b border-e border-dhis2-border'

const NO_KEYS: ReadonlyArray<CellKey> = []
const NO_MESSAGES: ReadonlyArray<CellMessage> = []

// Marked as a cell's notes are, on the header's light background.
const MESSAGE_TONES = {
    error: 'border-dhis2-destructive-indicator',
    warning: 'border-dhis2-warning-indicator',
} satisfies Record<Tone, string>

/** A row's name as it changes: its label cells' values (`labelFrom`), each as its field shows it, else its label. */
const CellsLabel = ({ row }: { row: GridRow }) => {
    const { store, settings } = useSpreadsheetStableContext()
    const labelFrom = row.labelFrom ?? NO_KEYS
    const selectNamed = useShallow((state: CellStoreState) =>
        labelFrom.map((key) => state.cells[key]?.value)
    )
    const named = useStore(store, selectNamed)
    return (
        <>
            {nameFrom(labelFrom, named, store.getState().fieldOf, settings) ||
                row.label}
        </>
    )
}

/**
 * A row's name, with its badge, a marker opening the source's and the rules' notes on it, and the rules' messages
 * without a field.
 */
export const RowHeader = memo(function RowHeader({
    idScope,
    tableId,
    row,
    openNotes,
}: {
    idScope: string
    tableId: string
    row: GridRow
    openNotes(target: NotesTarget): void
}) {
    const {
        effects,
        rowKeysOf,
        RowLabel = CellsLabel,
        RowBadge,
    } = useSpreadsheetStableContext()
    const rowHeader = rowHeaderDomId(idScope, tableId, row.id)
    const notes = useRowNotes(row)
    // Every key the row's messages are under, as for its notes.
    const selectMessages = useShallow((state: AnnotationsState) =>
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
    const messages = useStore(effects, selectMessages)
    return (
        <th
            scope="row"
            aria-describedby={
                notes.length === 0 ? undefined : notesDomId(rowHeader)
            }
            className={cn(
                BORDER_CLASS,
                ROW_HEADER_CLASS,
                'sticky start-0 z-10 bg-dhis2-background px-2 py-1 text-start align-middle font-normal text-dhis2-foreground [overflow-wrap:anywhere]'
            )}
        >
            {/* Cells are named by the label alone; the badge is said once, with the row. The label sets its own
                direction, so the header keeps the table's and stays at its start. */}
            <span id={rowHeader} dir="auto">
                <RowLabel row={row} />
            </span>
            {RowBadge === undefined ? null : <RowBadge rowId={row.id} />}
            <NotesMarker
                row={row}
                rowHeader={rowHeader}
                notes={notes}
                onOpen={openNotes}
            />
            {/* What the row's rules, or their failure, say without a field. */}
            {messages.length > 0 ? (
                <ul className="mt-0.5 flex flex-col gap-0.5">
                    {messages.map(({ tone, text }, i) => (
                        <li
                            key={i}
                            dir="auto"
                            className={cn(
                                'border-s-2 ps-1.5 text-xs text-dhis2-foreground',
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
