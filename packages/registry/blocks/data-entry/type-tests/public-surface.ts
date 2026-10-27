import type { ReactNode } from 'react'
import type {
    CellComponent,
    CellEffects,
    CellKey,
    CellMessage,
    CellOverrides,
    CellProps,
    CellState,
    CellView,
    CommitResult,
    ControlProps,
    DataEngine,
    DataEntrySource,
    DataEntryView,
    EventSourceOptions,
    EventStatus,
    GridColumn,
    GridRow,
    GridTable,
    HeaderCell,
    LoadedForm,
    MessageKind,
    NavKey,
    OutboxRecord,
    PendingChange,
    PendingRow,
    RulesTarget,
    SaveOutcome,
    SummaryItem,
    SyncState,
    SyncStatus,
} from '../index'
import {
    Cell,
    cells,
    DataEntry,
    DataEntrySummary,
    DataGrid,
    eventSource,
    useCell,
    useDataEntry,
} from '../index'

export type SupportedDataEntryTypes = [
    CellComponent,
    CellEffects,
    CellKey,
    CellMessage,
    CellOverrides,
    CellProps,
    CellState,
    CellView,
    CommitResult,
    ControlProps,
    DataEngine,
    DataEntrySource,
    DataEntryView,
    EventSourceOptions,
    EventStatus,
    GridColumn,
    GridRow,
    GridTable,
    HeaderCell,
    LoadedForm,
    MessageKind,
    NavKey,
    OutboxRecord,
    PendingChange,
    PendingRow,
    RulesTarget,
    SaveOutcome,
    SummaryItem,
    SyncState,
    SyncStatus,
]

// A source of events, a grid, and the summary beside it.
const source = eventSource({
    programId: 'eBAyeGv0exc',
    orgUnitId: 'DiszpKrYNg8',
})
export const sourceKeys: [string, string | undefined] = [
    source.key,
    source.cacheKey,
]

// A field's control replaced for one field, and for a value type everywhere.
const Notes: CellComponent = ({ cellKey, readOnly }) =>
    readOnly ?? `notes ${cellKey}`
const overrides: CellOverrides = {
    valueTypes: { LONG_TEXT: Notes },
    fields: { qrur9Dvnyt5: Notes },
}
export const page = (): ReactNode =>
    DataEntry({
        source,
        cells: overrides,
        children: [DataGrid({}), DataEntrySummary({ className: 'mt-4' })],
    })

// The defaults per kind, ready to wrap.
export const optionControl: CellComponent = cells.option
export const ownLayout = (): ReactNode =>
    Cell({
        cellKey: 'event1.qrur9Dvnyt5',
        field: { valueType: 'INTEGER_POSITIVE' },
        labelledBy: 'age-header',
        move: () => {},
    })

// One cell's state and effects; untouched cells read as idle with no effects.
export const useAge = (): [string | undefined, boolean, string | undefined] => {
    const view: CellView = useCell('event1.qrur9Dvnyt5')
    return [view.value, view.effects.required, view.effects.readOnly]
}
// @ts-expect-error A cell key is a row and a column joined by a dot.
export const useNoColumn = () => useCell('event1')

// A replacement control puts the cell's notes on the element that has its id.
export const describedBy = ({ aria }: ControlProps): string | undefined =>
    aria['aria-describedby']
// @ts-expect-error Cell hands every control the cell's ARIA attributes.
export const noAria: ControlProps = {
    id: 'cell',
    cellKey: 'event1.qrur9Dvnyt5',
    field: { valueType: 'TEXT' },
    labelledBy: 'header',
    move: () => {},
}

// A replacement control saves what was typed through its cell's view, and learns what became of it.
export const Typed: CellComponent = ({ id, cellKey, readOnly }) => {
    const { commit, draft, error } = useCell(cellKey)
    const result: CommitResult = commit('42')
    // @ts-expect-error The text typed or chosen, not a number.
    commit(42)
    return readOnly ?? `${id} ${result} ${draft} ${error}`
}

// Anything else, selected.
export const useCanComplete = (): boolean =>
    useDataEntry((view) => view.summary.canComplete)
export const useUnsent = (): number =>
    useDataEntry((view) => view.summary.unsent)
export const useActions = () =>
    useDataEntry((view) => view.complete) satisfies (
        rowId: string
    ) => Promise<SaveOutcome[]>
export const useReopen = () =>
    useDataEntry((view) => view.reopen) satisfies (
        rowId: string
    ) => Promise<SaveOutcome[]>
export const useAddRow = () =>
    useDataEntry((view) => view.addRow) satisfies (tableId: string) => void
export const useDownload = () =>
    useDataEntry((view) => view.downloadUnsent) satisfies () => void
export const useDiscard = () =>
    useDataEntry((view) => view.discardFailed) satisfies () => Promise<void>
// The form's rows, to lay out controls of your own by, such as a "Complete" button per row.
export const useRows = (): GridRow[] =>
    useDataEntry((view) => view.tables).flatMap(({ rows }) => rows)
// A row named as the grid names it: by its event date once it has one.
export const useRowName = (row: GridRow): string =>
    useCell(`${row.id}.occurredAt`).value ?? row.label
export const useLoadError = (): string | undefined =>
    useDataEntry((view) => view.error)
export const statuses: DataEntryView['status'][] = ['loading', 'ready', 'error']
export const syncs: SyncStatus[] = [
    'idle',
    'sending',
    'offline',
    'signIn',
    'retrying',
]
// @ts-expect-error There is no saving status: outcomes, never progress.
export const saving: DataEntryView['status'] = 'saving'
