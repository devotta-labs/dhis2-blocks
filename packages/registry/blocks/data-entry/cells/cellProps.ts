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

/** What `Cell` hands the control it picks for a field. */
export interface ControlProps extends CellProps {
    /**
     * The id for the control's focusable element. The grid's focus and arrows, paste, undo and the summary's links find
     * a cell by it, so a replacement control puts it on the one element that takes focus.
     */
    id: string
    /** Why the cell cannot be edited: it then shows its value, stays focusable and says why. */
    readOnly?: string
    /** A rule hides the cell: `readOnly` is the rule, and the cell shows "Hidden" instead of its value. */
    hidden?: boolean
}

export type CellComponent = (props: ControlProps) => ReactNode

/** Controls that replace the default one: by value type, and by field id (which wins). */
export interface CellOverrides {
    valueTypes?: Partial<Record<string, CellComponent>>
    fields?: Partial<Record<string, CellComponent>>
}

/** The id of the cell's focusable control, for the grid and the summary to focus it by. */
export const cellDomId = (key: CellKey) => `data-entry-cell-${key}`
