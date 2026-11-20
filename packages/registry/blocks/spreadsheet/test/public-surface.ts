import type { ReactNode } from 'react'
import { createStore } from 'zustand/vanilla'
import type {
    AnnotationsState,
    CellAnnotations,
    CellComponent,
    CellKey,
    CellMessage,
    CellOverrides,
    CellProps,
    CellState,
    CellView,
    CommitResult,
    ControlProps,
    DataEngine,
    GridColumn,
    GridRow,
    GridTable,
    HeaderCell,
    NavKey,
    SyncState,
    Tone,
} from '../index'
import {
    Cell,
    cellKey,
    cells,
    createCellStore,
    Spreadsheet,
    SpreadsheetGrid,
    useAnnounce,
    useCell,
    useRowCells,
} from '../index'

export type SupportedSpreadsheetTypes = [
    AnnotationsState,
    CellAnnotations,
    CellComponent,
    CellKey,
    CellMessage,
    CellOverrides,
    CellProps,
    CellState,
    CellView,
    CommitResult,
    ControlProps,
    DataEngine,
    GridColumn,
    GridRow,
    GridTable,
    HeaderCell,
    NavKey,
    SyncState,
    Tone,
]

const SETTINGS = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
const annotations = createStore<AnnotationsState>()(() => ({
    cells: {},
    rowMessages: new Map(),
    rowNotes: new Map(),
}))
const store = createCellStore({
    fields: new Map([['age', { valueType: 'INTEGER_POSITIVE' }]]),
    values: new Map([[cellKey('r1', 'age'), '7']]),
    settings: SETTINGS,
    annotations,
    enqueue: () => {},
})
interface Visit extends GridRow {
    visit: number
}
const visits: GridTable<Visit> = {
    id: 'visits',
    title: 'Visits',
    rows: [{ id: 'r1', label: 'Visit 1', visit: 1 }],
    columns: [{ id: 'age', label: 'Age' }],
    headerRows: [[{ id: 'age', label: 'Age', span: 1 }]],
    closed: new Map(),
}
export const sheet: () => ReactNode = () =>
    Spreadsheet({
        cells: store,
        annotations,
        tables: [visits],
        keyOf: (row, column) => cellKey(row.id, column.id),
        rowKeysOf: (row) => [row.id, `visit${row.visit}`],
        RowLabel: ({ row }) => `Visit ${row.visit}`,
        settings: SETTINGS,
        children: SpreadsheetGrid({}),
    })

export const useRowValues = (keys: CellKey[]) => {
    const { states } = useRowCells(keys)
    return states.map(({ value }) => value)
}
export const useSay: () => (text: string) => void = () => useAnnounce()

export const optionControl: CellComponent = cells.option
export const ownLayout = () =>
    Cell({
        cellKey: 'event1.qrur9Dvnyt5',
        field: { valueType: 'INTEGER_POSITIVE' },
        labelledBy: 'age-header',
        move: () => {},
    })

export const useAge: () => [
    string | undefined,
    boolean,
    string | undefined,
] = () => {
    const view: CellView = useCell('event1.qrur9Dvnyt5')
    return [view.value, view.effects.required, view.effects.readOnly]
}
// @ts-expect-error A cell key is a row and a column joined by a dot.
export const useNoColumn = () => useCell('event1')

export const describedBy = ({ aria }: ControlProps) => aria['aria-describedby']
// @ts-expect-error Cell hands every control the cell's ARIA attributes.
export const noAria: ControlProps = {
    id: 'cell',
    cellKey: 'event1.qrur9Dvnyt5',
    field: { valueType: 'TEXT' },
    labelledBy: 'header',
    move: () => {},
}

export const Typed: CellComponent = ({ id, cellKey, readOnly }) => {
    const { commit, draft, error } = useCell(cellKey)
    const result: CommitResult = commit('42')
    // @ts-expect-error The text typed or chosen, not a number.
    commit(42)
    return readOnly ?? `${id} ${result} ${draft} ${error}`
}

export const useRowName = (row: GridRow) => {
    const { value } = useCell(`${row.id}.name`)
    return value ?? row.label
}
