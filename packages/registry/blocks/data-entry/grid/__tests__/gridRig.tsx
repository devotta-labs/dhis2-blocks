import { useMemo, useState } from 'react'
import { render } from 'vitest-browser-react'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { Field } from '@/components/dhis2-value-types'
import type { CellOverrides } from '../../cells/cellProps'
import type { CellEffects, CellMessage } from '../../logic/effects'
import { cellKey } from '../../model/types'
import type { CellKey, GridTable, HeaderCell } from '../../model/types'
import { createAnnouncer, DataEntryReactContext } from '../../provider/context'
import type { DataEntryContext, EffectsState } from '../../provider/context'
import { LiveRegion } from '../../provider/DataEntry'
import { createDataEntryStore } from '../../store/store'
import { DataGrid } from '../DataGrid'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
/** What the grids of this rig prefix their DOM ids with. */
export const ID_SCOPE = 'data-entry'
export const INTEGER: Field = { valueType: 'INTEGER' }

interface TableOptions {
    id?: string
    /** Column labels; the columns are `c0`, `c1`, … */
    columns?: string[]
    /** Each column's field; integers when absent. */
    fields?: Field[]
    /** Row labels; the rows are `<table id>r0`, `<table id>r1`, … */
    rows?: string[]
    /** A header row above the column labels. */
    groups?: HeaderCell[]
    closed?: CellKey[]
}

export const makeTable = ({
    id = 't1',
    columns = ['Age (years)'],
    fields = [],
    rows = ['2026-10-20'],
    groups,
    closed = [],
}: TableOptions = {}): GridTable => {
    const gridColumns = columns.map((label, i) => ({
        id: `c${i}`,
        label,
        field: fields[i] ?? INTEGER,
    }))
    const leaves = gridColumns.map(({ id, label }) => ({ id, label, span: 1 }))
    return {
        id,
        title: `Table ${id}`,
        rows: rows.map((label, i) => ({ id: `${id}r${i}`, label })),
        columns: gridColumns,
        headerRows: groups === undefined ? [leaves] : [groups, leaves],
        closed: new Map(closed.map((key) => [key, 'Not used'])),
    }
}

/** The table with a new row at its end, as the provider adds one: `<table id>r<n>`, closed in `closedColumns`. */
const withNewRow = (
    table: GridTable,
    closedColumns: ReadonlyArray<string>
): GridTable => {
    const id = `${table.id}r${table.rows.length}`
    return {
        ...table,
        rows: [...table.rows, { id, label: 'New event', isNew: true }],
        closed: new Map([
            ...table.closed,
            ...closedColumns.map((column): [CellKey, string] => [
                cellKey(id, column),
                'Not in this stage',
            ]),
        ]),
    }
}

interface MountOptions {
    values?: Array<[CellKey, string]>
    effects?: Partial<Record<CellKey, Partial<CellEffects>>>
    newRowTables?: string[]
    /** Columns closed on a row "Add event" adds. */
    closedOnNewRows?: string[]
    /** Space above the grid, to push it to the bottom of the screen. */
    above?: string
    /** Called whenever a cell reads its effects or the grid reads its tables, as each does when it renders. */
    onRead?: (what: 'effects' | 'tables') => void
    overrides?: CellOverrides
    /** Row id → the row's messages without a field. */
    rowMessages?: Array<[string, CellMessage[]]>
}

/** A grid over `tables` in a context of its own; `addRow` appends a row to its table. */
export const mount = async (
    tables: GridTable[],
    options: MountOptions = {}
) => {
    const {
        values = [],
        newRowTables = [],
        closedOnNewRows = [],
        above,
        onRead,
        overrides,
        rowMessages = [],
    } = options
    const store = createDataEntryStore({
        tables,
        values: new Map(values),
        settings: GREGORIAN,
        enqueue: () => {},
    })
    const cells: EffectsState['cells'] = {}
    for (const [key, effects] of Object.entries(options.effects ?? {})) {
        // SAFETY: the keys were typed as cell keys above; Object.entries widens them to string.
        cells[key as CellKey] = { required: false, messages: [], ...effects }
    }
    const effects = createStore<EffectsState>()(() => ({
        cells,
        rowMessages: new Map(rowMessages),
        rowNotes: new Map(),
    }))
    const counted: StoreApi<EffectsState> = {
        ...effects,
        getState: () => {
            onRead?.('effects')
            return effects.getState()
        },
    }
    const announcer = createAnnouncer()
    const announced: string[] = []
    const announce = (text: string) => {
        announced.push(text)
        announcer.announce(text)
    }
    const added: string[] = []
    const Harness = () => {
        const [current, setTables] = useState(tables)
        const context = useMemo(
            (): DataEntryContext => ({
                store,
                effects: counted,
                idScope: ID_SCOPE,
                overrides,
                settings: GREGORIAN,
                announce,
                announcements: announcer.announcements,
                get tables() {
                    onRead?.('tables')
                    return current
                },
                newRowTables: new Set(newRowTables),
                addRow: (tableId) => {
                    added.push(tableId)
                    setTables((all) =>
                        all.map((table) =>
                            table.id === tableId
                                ? withNewRow(table, closedOnNewRows)
                                : table
                        )
                    )
                },
            }),
            [current]
        )
        return (
            <DataEntryReactContext.Provider value={context}>
                {above === undefined ? null : <div style={{ height: above }} />}
                <DataGrid />
                <button type="button">After</button>
                <LiveRegion />
            </DataEntryReactContext.Provider>
        )
    }
    await render(<Harness />)
    return {
        store,
        announce,
        announced,
        added,
        value: (key: CellKey) => store.getState().cells[key]?.value,
    }
}

/** The cell's control, whichever form on the page it is in: its id ends in the cell's key. */
export const control = (key: CellKey): HTMLElement => {
    const element = document.querySelector(`[id$="-cell-${key}"]`)
    if (!(element instanceof HTMLElement)) {
        throw new Error(`No control for ${key}`)
    }
    return element
}

export const focused = () => document.activeElement?.id

/** Pastes as a spreadsheet does; says whether the grid took the paste from the browser. */
export const paste = (target: HTMLElement, text: string) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)
    const event = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
    })
    target.dispatchEvent(event)
    return event.defaultPrevented
}

export const nextFrame = () =>
    new Promise<number>((resolve) => requestAnimationFrame(resolve))

/** The part of an element on screen once every scrolling ancestor has clipped it. */
export const visibleBox = (element: Element) =>
    new Promise<DOMRectReadOnly>((resolve) => {
        const observer = new IntersectionObserver(([entry]) => {
            observer.disconnect()
            resolve(entry.intersectionRect)
        })
        observer.observe(element)
    })

/**
 * The declarations styling an element, apart: those every browser applies, and those applied only where the browser
 * has anchor positioning (inside `@supports (anchor-name: …)`).
 */
export const stylesFor = (element: Element) => {
    const always: string[] = []
    const anchored: string[] = []
    const walk = (rules: CSSRuleList, guarded: boolean) => {
        for (const rule of Array.from(rules)) {
            if (
                rule instanceof CSSStyleRule &&
                element.matches(rule.selectorText)
            ) {
                const list = guarded ? anchored : always
                list.push(rule.style.cssText)
            }
            if (rule instanceof CSSGroupingRule) {
                walk(
                    rule.cssRules,
                    guarded ||
                        (rule instanceof CSSSupportsRule &&
                            rule.conditionText.includes('anchor-name'))
                )
            }
        }
    }
    for (const sheet of Array.from(document.styleSheets)) {
        walk(sheet.cssRules, false)
    }
    return { always: always.join(' '), anchored: anchored.join(' ') }
}

export const range = (count: number, name: (i: number) => string) =>
    Array.from({ length: count }, (_, i) => name(i))
