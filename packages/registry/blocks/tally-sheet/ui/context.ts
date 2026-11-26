import { createContext, useContext } from 'react'
import type { ComponentType } from 'react'
import type { TallyIndex } from '../core/layout'
import type { TallyLayout, TallyRow } from '../core/types'
import type { TallyStore } from '../store/store'
import type { HeaderLevel, RowSection, SheetIds } from './headers'
import type { SheetPointer } from './pointer'

/** What editing began from: each cell's sum and shown count, and the drafts typed since, by cell. */
export interface EditSession {
    /** Counts the saves and drops since editing began; the fields start again from the counts at each. */
    round: number
    sums: readonly number[]
    counts: readonly number[]
    drafts: Map<number, string>
}

export interface TallyContextValue {
    layout: TallyLayout
    label: string
    store: TallyStore
    index: TallyIndex
    levels: readonly HeaderLevel[]
    sections: readonly RowSection[]
    ids: SheetIds
    /** The DOM id of each row's group heading, by row; none for a row with no group. */
    groupIds: ReadonlyArray<string | undefined>
    pointer: SheetPointer
    editing: boolean
    session: EditSession | undefined
    setEditing(editing: boolean): void
    /** Ends editing: saves the drafts that changed a count when `save`, else drops them. */
    finishEditing(save: boolean): void
    tapCell(cell: number): void
    undo(): void
    RowBadge?: ComponentType<{ row: TallyRow; total: number }>
}

export const TallyContext = createContext<TallyContextValue | null>(null)

export const useTallyContext = (name: string) => {
    const context = useContext(TallyContext)
    if (!context) throw new Error(`${name} must be used within TallySheet.`)
    return context
}
