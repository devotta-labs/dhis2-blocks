import type { ReactNode } from 'react'
import type {
    TallyCategory,
    TallyClosedCell,
    TallyColumn,
    TallyCount,
    TallyEntry,
    TallyLayout,
    TallyOptions,
    TallyRow,
    TallySheetProps,
} from '../index'
import {
    mergeTallyEntries,
    TallyEditButtons,
    TallyToolbar,
    TallyGrid,
    tallyColumns,
    tallyCounts,
    unplacedTallyEntries,
    TallySheet,
    TallyTotal,
    TallyUndoButton,
    useTally,
    useTallyCount,
    useTallyRowTotal,
    useTallyTotal,
} from '../index'

export type SupportedTallyTypes = [
    TallyCategory,
    TallyClosedCell,
    TallyColumn,
    TallyCount,
    TallyEntry,
    TallyLayout,
    TallyOptions,
    TallyRow,
    TallySheetProps,
]

const layout: TallyLayout = {
    rows: [{ id: 'opv1', label: 'OPV 1', group: '6 weeks' }],
    categories: [
        {
            id: 'sex',
            label: 'Sex',
            options: [
                { id: 'female', label: 'Female' },
                { id: 'male', label: 'Male' },
            ],
        },
    ],
    closed: [{ row: 'opv1', options: { sex: 'male' } }],
}

const corrected: TallyEntry = {
    id: 'correction-opv1-female',
    at: '2026-11-25T08:00:00.000Z',
    kind: 'correction',
    row: 'opv1',
    options: { sex: 'female' },
    delta: 1,
}

const AlertBadge = ({ row, total }: { row: TallyRow; total: number }) =>
    total > 10 ? `${row.label}: alert` : null

export const sheet: () => ReactNode = () =>
    TallySheet({
        layout,
        label: 'Immunisation',
        defaultEntries: [corrected],
        by: 'tablet-1',
        newId: () => 'a1B2c3D4e5F',
        onAppend: (entries) => entries.map(({ id }) => id),
        RowBadge: AlertBadge,
        children: [
            TallyToolbar({
                className: 'sticky top-0',
                children: TallyTotal({}),
            }),
            TallyTotal({}),
            TallyEditButtons({ className: 'ms-auto' }),
            TallyGrid({}),
            TallyUndoButton({}),
        ],
    })

export const saved: readonly TallyCount[] = tallyCounts(
    layout,
    mergeTallyEntries([], [])
)
export const leftOver: readonly TallyEntry[] = unplacedTallyEntries(layout, [
    corrected,
])
export const columns: readonly TallyColumn[] = tallyColumns(layout)

export const useParts = () => {
    const { tap, undo, canUndo, editing, setEditing } = useTally()
    tap('opv1', { sex: 'female' })
    undo()
    setEditing(!editing)
    const count: number = useTallyCount('opv1', { sex: 'female' })
    const row: number = useTallyRowTotal('opv1')
    const total: number = useTallyTotal()
    return canUndo ? count + row + total : 0
}

// @ts-expect-error A sheet needs a label for screen readers.
export const unnamed = () => TallySheet({ layout })

// @ts-expect-error Options are chosen by category id.
export const useNoOptions = () => useTallyCount('opv1')

// @ts-expect-error The store stays inside the block.
export { createTallyStore } from '../index'
