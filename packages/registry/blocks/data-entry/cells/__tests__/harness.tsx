import type { ReactNode } from 'react'
import type { Locator } from 'vitest/browser'
import { createStore } from 'zustand/vanilla'
import type { Field } from '@/components/dhis2-value-types'
import type { NavKey } from '../../grid/navigation'
import type { CellEffects } from '../../logic/effects'
import { cellKey } from '../../model/types'
import type { CellKey, GridTable } from '../../model/types'
import { createAnnouncer, DataEntryReactContext } from '../../provider/context'
import type { DataEntryContext, EffectsState } from '../../provider/context'
import { createDataEntryStore } from '../../store/store'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

export const CELL: CellKey = cellKey('r1', 'c1')
/** The id of the header that names the cell. */
export const HEADER = 'header'

interface RigOptions {
    value?: string
    effects?: Partial<CellEffects>
}

/** One cell in a store of its own, with the effects store and what the cell asked of the grid. */
export const rig = (field: Field, { value, effects }: RigOptions = {}) => {
    const enqueued: Array<[CellKey, string | null, string | null]> = []
    const moves: NavKey[] = []
    const table: GridTable = {
        id: 't1',
        title: 'Table',
        rows: [{ id: 'r1', label: 'Row' }],
        columns: [{ id: 'c1', label: 'Column', field }],
        headerRows: [[{ id: 'c1', label: 'Column', span: 1 }]],
        closed: new Map(),
    }
    const store = createDataEntryStore({
        tables: [table],
        values: new Map(value === undefined ? [] : [[CELL, value]]),
        settings: GREGORIAN,
        enqueue: (key, saved, base) => enqueued.push([key, saved, base]),
    })
    const effectsStore = createStore<EffectsState>()(() => ({
        cells:
            effects === undefined
                ? {}
                : { [CELL]: { required: false, messages: [], ...effects } },
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))
    const announced: string[] = []
    const context: DataEntryContext = {
        store,
        effects: effectsStore,
        settings: GREGORIAN,
        announce: (text: string) => {
            announced.push(text)
        },
        announcements: createAnnouncer().announcements,
        tables: [table],
        newRowTables: new Set(),
        addRow: () => {},
    }
    return {
        store,
        effects: effectsStore,
        enqueued,
        moves,
        /** What the cell said in the grid's live region. */
        announced,
        move: (key: NavKey) => {
            moves.push(key)
        },
        /** What the grid would put around a cell: the header that names it. */
        ui: (cell: ReactNode) => (
            <DataEntryReactContext.Provider value={context}>
                <span id={HEADER}>Age (years)</span>
                {cell}
            </DataEntryReactContext.Provider>
        ),
        stored: () => store.getState().cells[CELL],
    }
}

export const inputOf = (locator: Locator): HTMLInputElement => {
    const element = locator.element()
    if (!(element instanceof HTMLInputElement)) {
        throw new Error('Expected the cell to be an input')
    }
    return element
}
