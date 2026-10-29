import { CustomDataProvider } from '@dhis2/app-runtime'
import type { ComponentProps, ReactNode } from 'react'
import { onTestFinished } from 'vitest'
import type { Locator } from 'vitest/browser'
import { createStore } from 'zustand/vanilla'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type { NavKey } from '../../grid/navigation'
import type { CellEffects } from '../../logic/effects'
import { summarise } from '../../logic/summary'
import { cellKey } from '../../model/types'
import type { CellKey, GridTable } from '../../model/types'
import type { SyncStatus } from '../../outbox/sync'
import { createAnnouncer, DataEntryReactContext } from '../../provider/context'
import type { DataEntryContext, EffectsState } from '../../provider/context'
import { DataEntryViewContext } from '../../provider/hooks'
import type { DataEntryView } from '../../provider/hooks'
import { createDataEntryStore } from '../../store/store'
import type { CellOverrides } from '../cellProps'
import { popupEditors } from '../popupEditors'
import type { PopupEditor, PopupValueType } from '../popupEditors'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

type ServerData = ComponentProps<typeof CustomDataProvider>['data']
/** The request a fake server's answer is made for. */
export type ServerRequest = Parameters<
    Extract<ServerData[string], (...args: never) => void>
>[1]

export const CELL: CellKey = cellKey('r1', 'c1')
/** The id of the header that names the cell. */
export const HEADER = 'header'

interface RigOptions {
    value?: string
    effects?: Partial<CellEffects>
    overrides?: CellOverrides
    /** The system calendar and date format; Gregorian, year first, by default. */
    settings?: ValueSettings
    /** The names known for org unit ids. */
    orgUnitNames?: ReadonlyMap<string, string>
    /** The names known for file ids, as the form loads them. */
    fileNames?: ReadonlyMap<string, string>
    /** What the fake server answers, for editors that search it. */
    data?: ServerData
    /** The form's sync state; `'idle'` by default. */
    sync?: SyncStatus
}

/** One cell in a store of its own, with the effects store and what the cell asked of the grid. */
export const rig = (
    field: Field,
    {
        value,
        effects,
        overrides,
        settings = GREGORIAN,
        orgUnitNames = new Map(),
        fileNames = new Map(),
        data = {},
        sync = 'idle',
    }: RigOptions = {}
) => {
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
        settings,
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
        idScope: 'data-entry',
        settings,
        announce: (text: string) => {
            announced.push(text)
        },
        announcements: createAnnouncer().announcements,
        tables: [table],
        newRowTables: new Set(),
        addRow: () => {},
        overrides,
        orgUnitNames: createStore(() => ({ names: orgUnitNames })),
        fileNames: createStore(() => ({ names: fileNames })),
    }
    const view = createStore<DataEntryView>()(() => ({
        status: 'ready',
        tables: [table],
        summary: summarise({}, {}, new Map(), [table]),
        sync,
        addRow: () => {},
        complete: async () => [],
        reopen: async () => [],
        downloadUnsent: () => {},
        discardFailed: async () => {},
        hasMore: false,
        loadingMore: false,
        loadMore: async () => {},
    }))
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
            <CustomDataProvider data={data}>
                <DataEntryViewContext.Provider value={view}>
                    <DataEntryReactContext.Provider value={context}>
                        <span id={HEADER}>Age (years)</span>
                        {cell}
                    </DataEntryReactContext.Provider>
                </DataEntryViewContext.Provider>
            </CustomDataProvider>
        ),
        stored: () => store.getState().cells[CELL],
    }
}

/** Registers `editor` for `type` until the test ends; `undefined` leaves the type without one. */
export const withEditor = (
    type: PopupValueType,
    editor: PopupEditor | undefined
) => {
    const before = popupEditors[type]
    popupEditors[type] = editor
    onTestFinished(() => {
        popupEditors[type] = before
    })
}

export const inputOf = (locator: Locator): HTMLInputElement => {
    const element = locator.element()
    if (!(element instanceof HTMLInputElement)) {
        throw new Error('Expected the cell to be an input')
    }
    return element
}
