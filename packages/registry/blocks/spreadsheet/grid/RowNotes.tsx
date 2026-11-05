import i18n from '@dhis2/d2-i18n'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/dhis2/ui/button'
import { Popover, PopoverContent } from '@/components/dhis2/ui/popover'
import type { GridRow } from '../model/types'
import { useSpreadsheetContext } from '../provider/context'

const NO_NOTES: ReadonlyArray<string> = []

/**
 * The row's notes, once each, from every key it is under: a register's row shows what the rules say of each of its
 * events, once, as a program's rule says the same of every event it runs on.
 */
export const useRowNotes = (row: GridRow) => {
    const { effects, rowKeysOf } = useSpreadsheetContext()
    return useStore(
        effects,
        useShallow((state) => [
            ...new Set(
                rowKeysOf(row).flatMap(
                    (id) => state.rowNotes.get(id) ?? NO_NOTES
                )
            ),
        ])
    )
}

/** What the grid's one notes popover is open for: the row, and the marker that opened it, where focus goes back. */
export interface NotesTarget {
    anchor: HTMLElement
    row: GridRow
    /** The DOM id of the row's header. */
    rowHeader: string
}

/** The DOM id of the hidden copy of a row's notes, the row header's description. */
export const notesDomId = (rowHeader: string) => `${rowHeader}-notes-text`

/**
 * A row's notes as a marker with their count, out of the Tab order as the actions buttons are, opening them in the
 * grid's notes popover; a hidden copy is the row header's description, so screen readers hear them with the row.
 */
export const NotesMarker = ({
    row,
    rowHeader,
    notes,
    onOpen,
}: Omit<NotesTarget, 'anchor'> & {
    notes: ReadonlyArray<string>
    onOpen(target: NotesTarget): void
}) =>
    notes.length === 0 ? null : (
        <>
            <Button
                id={`${rowHeader}-notes`}
                variant="ghost"
                size="sm"
                tabIndex={-1}
                aria-haspopup="dialog"
                className="ms-1 h-5 px-1 align-middle text-xs text-dhis2-grey-700"
                onClick={(event) =>
                    onOpen({ anchor: event.currentTarget, row, rowHeader })
                }
            >
                {notes.length === 1
                    ? i18n.t('Note')
                    : i18n.t('Notes: {{count}}', {
                          nsSeparator: '::',
                          count: notes.length,
                      })}
            </Button>
            <span id={notesDomId(rowHeader)} hidden>
                {notes.join('\n')}
            </span>
        </>
    )

/** A row's notes, each as plain text with its line breaks. */
const NotesList = ({ row }: { row: GridRow }) => (
    <ul className="flex flex-col gap-2">
        {useRowNotes(row).map((note, i) => (
            <li
                key={i}
                dir="auto"
                className="whitespace-pre-wrap [overflow-wrap:anywhere]"
            >
                {note}
            </li>
        ))}
    </ul>
)

/** The grid's one popover of a row's notes, kept after it closes so it closes in place. */
export const NotesPopover = ({
    target,
    onClose,
}: {
    target: (NotesTarget & { open: boolean }) | undefined
    onClose(): void
}) =>
    target === undefined ? null : (
        <Popover
            open={target.open}
            onOpenChange={(next) => {
                if (!next) {
                    onClose()
                }
            }}
        >
            <PopoverContent
                anchor={target.anchor}
                align="start"
                aria-labelledby={`${target.anchor.id} ${target.rowHeader}`}
                finalFocus={() => target.anchor}
                className="max-h-[50vh] overflow-auto"
            >
                <NotesList row={target.row} />
            </PopoverContent>
        </Popover>
    )
