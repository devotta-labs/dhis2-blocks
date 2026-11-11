import { announce as sharedAnnounce } from '@/components/dhis2/ui/announcer'
import type { Politeness } from '@/components/dhis2/ui/announcer'
import { CustomDataProvider } from '@dhis2/app-runtime'
import { useMemo, useState } from 'react'
import type { ProfilerOnRenderCallback, ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { createStore } from 'zustand/vanilla'
import type { Field } from '@/components/dhis2-value-types'
import type { CellOverrides } from '../../cells/cellProps'
import type {
    AnnotationsState,
    CellAnnotations,
    CellMessage,
} from '../../model/annotations'
import { cellKey } from '../../model/types'
import type {
    CellKey,
    GridColumn,
    GridRow,
    GridTable,
    HeaderCell,
} from '../../model/types'
import {
    SpreadsheetReactContext,
    useSpreadsheetContext,
} from '../../provider/context'
import type { SpreadsheetContext } from '../../provider/context'
import { Spreadsheet } from '../../provider/Spreadsheet'
import { createCellStore } from '../../store/store'
import { SpreadsheetGrid } from '../SpreadsheetGrid'
import { TableRowProfilerContext } from '../TableBody'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
/** What the grids of this rig prefix their DOM ids with. */
export const ID_SCOPE = 'data-entry'
export const INTEGER: Field = { valueType: 'INTEGER' }

/** A table whose columns carry their fields, from which the rig's cell store learns them by column id. */
type RigTable = GridTable<GridRow, GridColumn & { field: Field }>

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
    /** The heading rows in full, for headings that span rows; replaces the column labels and `groups`. */
    headerRows?: HeaderCell[][]
    closed?: CellKey[]
}

export const makeTable = ({
    id = 't1',
    columns = ['Age (years)'],
    fields = [],
    rows = ['2026-10-20'],
    groups,
    headerRows,
    closed = [],
}: TableOptions = {}): RigTable => {
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
        headerRows:
            headerRows ?? (groups === undefined ? [leaves] : [groups, leaves]),
        closed: new Map(closed.map((key) => [key, 'Not used'])),
    }
}

/** The table with a new row at its end, as the provider adds one: `<table id>r<n>`, closed in `closedColumns`. */
const withNewRow = (
    table: RigTable,
    closedColumns: ReadonlyArray<string>
): RigTable => {
    const id = `${table.id}r${table.rows.length}`
    return {
        ...table,
        rows: [...table.rows, { id, label: 'New event' }],
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
    effects?: Partial<Record<CellKey, Partial<CellAnnotations>>>
    /** Tables whose "Add event" button appends a row to them. */
    newRowTables?: string[]
    /** The provider's add buttons; replaces those `newRowTables` makes. */
    addRow?: SpreadsheetContext['addRow']
    /** Columns closed on a row "Add event" adds. */
    closedOnNewRows?: string[]
    /** Space above the grid, to push it to the bottom of the screen. */
    above?: string
    /** Called whenever a cell reads its effects or the grid reads its tables, as each does when it renders. */
    onRead?: (what: 'effects' | 'tables') => void
    /** Called whenever anything subscribes to the cells' store or the effects store. */
    onSubscribe?: () => void
    overrides?: CellOverrides
    /** Row id → the row's messages without a field. */
    rowMessages?: Array<[string, CellMessage[]]>
    /** Row id → the row's notes. */
    rowNotes?: Array<[string, string[]]>
    /** What each row header shows beside its label. */
    RowBadge?: SpreadsheetContext['RowBadge']
    /** Profiles rows in React tests. */
    onRowRender?: ProfilerOnRenderCallback
    /** What follows the tables. */
    GridFooter?: SpreadsheetContext['GridFooter']
    /** The provider's cell key; `cellKey(row.id, column.id)` when absent. */
    keyOf?: SpreadsheetContext['keyOf']
    /** The provider's row keys; `[row.id]` when absent. */
    rowKeysOf?: SpreadsheetContext['rowKeysOf']
    /** Which column id a cell key's field is; the part after the dot when absent. */
    fieldIdOf?: (key: CellKey) => string
    /** The provider's bulk columns; every column when absent. */
    bulkColumn?: (column: RigTable['columns'][number]) => boolean
    /** Cells the store refuses to change, whatever the annotations say. */
    locked?: (key: CellKey) => boolean
    /** The system's calendar and date format; ISO dates when absent. */
    settings?:
        | typeof GREGORIAN
        | { calendar: 'iso8601'; dateFormat: 'DD-MM-YYYY' }
    /** What the provider asks before a bulk write; nothing when absent. */
    confirmBulk?: SpreadsheetContext['confirmBulk']
}

/** A grid over `tables` in a context of its own; `addRow` appends a row to its table. */
export const mount = async (tables: RigTable[], options: MountOptions = {}) => {
    const {
        values = [],
        newRowTables = [],
        closedOnNewRows = [],
        above,
        onRead,
        onSubscribe,
        overrides,
        rowMessages = [],
        rowNotes = [],
        keyOf,
        rowKeysOf,
        fieldIdOf,
        RowBadge,
        onRowRender,
        GridFooter,
        bulkColumn,
        confirmBulk,
        locked,
        settings = GREGORIAN,
    } = options
    const cells: AnnotationsState['cells'] = {}
    for (const [key, effects] of Object.entries(options.effects ?? {})) {
        // SAFETY: the keys were typed as cell keys above; Object.entries widens them to string.
        cells[key as CellKey] = { required: false, messages: [], ...effects }
    }
    const effects = createStore<AnnotationsState>()(() => ({
        cells,
        rowMessages: new Map(rowMessages),
        rowNotes: new Map(rowNotes),
    }))
    const store = createCellStore({
        fields: new Map(
            tables.flatMap((each) =>
                each.columns.map(({ id, field }): [string, Field] => [
                    id,
                    field,
                ])
            )
        ),
        fieldIdOf,
        locked,
        values: new Map(values),
        settings,
        annotations: effects,
        enqueue: () => {},
    })
    const counted: typeof effects = {
        ...effects,
        getState: () => {
            onRead?.('effects')
            return effects.getState()
        },
        subscribe: (listener) => {
            onSubscribe?.()
            return effects.subscribe(listener)
        },
    }
    const watched: typeof store = {
        ...store,
        subscribe: (listener) => {
            onSubscribe?.()
            return store.subscribe(listener)
        },
    }
    const announced: string[] = []
    const announce = (text: string, politeness?: Politeness) => {
        announced.push(text)
        sharedAnnounce(text, politeness)
    }
    const added: string[] = []
    /** The spreadsheet's context, counting each read of its tables, as the grid makes one when it renders. */
    const CountedTables = ({ children }: { children: ReactNode }) => {
        const context = useSpreadsheetContext()
        const reading = useMemo(
            (): SpreadsheetContext => ({
                ...context,
                get tables() {
                    onRead?.('tables')
                    return context.tables
                },
            }),
            [context]
        )
        return (
            <SpreadsheetReactContext.Provider value={reading}>
                {children}
            </SpreadsheetReactContext.Provider>
        )
    }
    const Harness = () => {
        const [current, setTables] = useState(tables)
        const addRow = useMemo(
            (): SpreadsheetContext['addRow'] =>
                options.addRow ??
                new Map(
                    newRowTables.map((tableId) => [
                        tableId,
                        {
                            label: 'Add event',
                            add() {
                                added.push(tableId)
                                setTables((all) =>
                                    all.map((table) =>
                                        table.id === tableId
                                            ? withNewRow(table, closedOnNewRows)
                                            : table
                                    )
                                )
                            },
                        },
                    ])
                ),
            []
        )
        return (
            <Spreadsheet
                cells={watched}
                annotations={counted}
                tables={current}
                keyOf={keyOf}
                rowKeysOf={rowKeysOf}
                settings={settings}
                idScope={ID_SCOPE}
                overrides={overrides}
                addRow={addRow}
                announcer={{ announce }}
                RowBadge={RowBadge}
                GridFooter={GridFooter}
                bulkColumn={bulkColumn}
                confirmBulk={confirmBulk}
            >
                <CountedTables>
                    {above === undefined ? null : (
                        <div style={{ height: above }} />
                    )}
                    <TableRowProfilerContext.Provider value={onRowRender}>
                        <SpreadsheetGrid />
                    </TableRowProfilerContext.Provider>
                    <button type="button">After</button>
                </CountedTables>
            </Spreadsheet>
        )
    }
    await render(
        <CustomDataProvider data={{}}>
            <Harness />
        </CustomDataProvider>
    )
    return {
        store,
        effects,
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
