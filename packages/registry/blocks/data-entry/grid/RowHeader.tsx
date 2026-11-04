import i18n from '@dhis2/d2-i18n'
import { memo } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Field } from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import type { CellMessage, MessageKind } from '../logic/effects'
import { cellKey, recordsOf } from '../model/types'
import type { CellKey, GridRow } from '../model/types'
import { useDataEntryContext } from '../provider/context'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import { nameFrom, rowHeaderDomId, rowLabel } from './headers'

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
    errorOnComplete: 'border-dhis2-red-600',
    warning: 'border-dhis2-yellow-700',
    warningOnComplete: 'border-dhis2-yellow-700',
} satisfies Record<MessageKind, string>

/**
 * What names the row, as it changes: a person by their label cells' values, each as its column (`fields`) shows it;
 * any other row as `rowLabel` says. Nothing for no row.
 */
export const useRowLabel = (
    row: GridRow | undefined,
    fields: ReadonlyMap<string, Field>
) => {
    const { store, settings, records } = useDataEntryContext()
    const id = row?.id ?? ''
    const date = useStore(
        store,
        (state) => state.cells[cellKey(id, EVENT_DATE_COLUMN)]?.value
    )
    const labelFrom = row?.labelFrom ?? NO_KEYS
    const named = useStore(
        store,
        useShallow((state) => labelFrom.map((key) => state.cells[key]?.value))
    )
    if (row === undefined) {
        return undefined
    }
    return (
        nameFrom(labelFrom, named, fields, settings) ||
        rowLabel(row, records.get(row.id), date, settings)
    )
}

/** A row's name, with its status, the source's and the rules' notes on it, and the rules' messages without a field. */
export const RowHeader = memo(function RowHeader({
    idScope,
    tableId,
    row,
    fields,
}: {
    idScope: string
    tableId: string
    row: GridRow
    /** The table's fields by id, which its label cells are shown through. */
    fields: ReadonlyMap<string, Field>
}) {
    const { effects, records } = useDataEntryContext()
    const record = records.get(row.id)
    // Every record the row's cells save to: a register's row shows what the rules say of each of its events, once,
    // as a program's rule says the same of every event it runs on.
    const notes = useStore(
        effects,
        useShallow((state) => [
            ...new Set(
                recordsOf(row).flatMap(
                    (id) => state.rowNotes.get(id) ?? NO_NOTES
                )
            ),
        ])
    )
    const messages = useStore(
        effects,
        useShallow((state) =>
            recordsOf(row)
                .flatMap((id) => state.rowMessages.get(id) ?? NO_MESSAGES)
                .filter(
                    (message, at, all) =>
                        all.findIndex(
                            ({ kind, text }) =>
                                kind === message.kind && text === message.text
                        ) === at
                )
        )
    )
    const label = useRowLabel(row, fields)
    const status = record?.kind === 'event' ? record.status : undefined
    const scheduled =
        status === 'SCHEDULE' || status === 'OVERDUE'
            ? i18n.t('Scheduled')
            : undefined
    const marker = status === 'COMPLETED' ? i18n.t('Completed') : scheduled
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
                {label}
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
