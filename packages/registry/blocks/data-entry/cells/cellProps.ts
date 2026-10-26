import type { ReactNode } from 'react'
import type { Field } from '@/components/dhis2-value-types'
import type { NavKey } from '../grid/navigation'
import type { CellKey } from '../model/types'

export interface CellProps {
    cellKey: CellKey
    field: Field
    /** Ids of the header cells that name this cell. */
    labelledBy: string
    /**
     * Asks the grid to move focus, after the cell has saved what was typed. Tab is reported but not cancelled: the
     * browser's own Tab moves focus, so keyboard users are never trapped; the grid uses the report to remember where
     * a run of Tabs began.
     */
    move(key: NavKey): void
}

export type CellComponent = (props: CellProps) => ReactNode

/** The id of the cell's focusable control, for the grid and the summary to focus it by. */
export const cellDomId = (key: CellKey) => `data-entry-cell-${key}`
