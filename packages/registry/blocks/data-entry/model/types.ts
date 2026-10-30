import type { Field } from '@/components/dhis2-value-types'

/** `<rowId>.<columnId>`; row ids contain no dot. */
export type CellKey = `${string}.${string}`

export const cellKey = (rowId: string, columnId: string): CellKey =>
    `${rowId}.${columnId}`

export const rowIdOf = (key: string) => key.slice(0, key.indexOf('.'))

export type EventStatus =
    | 'ACTIVE'
    | 'COMPLETED'
    | 'SCHEDULE'
    | 'SKIPPED'
    | 'VISITED'
    | 'OVERDUE'

export interface GridRow {
    id: string
    /** Names the row until it has an event date; then the date does, in the system calendar and format. */
    label: string
    /** The stage's name, shown after the event date in a grid of several stages. */
    stage?: string
    /** The day (`YYYY-MM-DD`) a scheduled event is due: it names the row, as its event date would, until it has one. */
    scheduledAt?: string
    programStageId?: string
    enrollmentId?: string
    orgUnitId?: string
    status?: EventStatus
    isNew?: boolean
}

export interface GridColumn {
    id: string
    label: string
    field: Field
}

export interface HeaderCell {
    id: string
    label: string
    span: number
}

export interface GridTable {
    id: string
    title: string
    rows: GridRow[]
    columns: GridColumn[]
    headerRows: HeaderCell[][]
    /** Cells with no control, skipped by the arrows, with their reason ("Not used", "Not in this stage"). */
    closed: ReadonlyMap<CellKey, string>
}

export type SyncState =
    | 'idle'
    | 'queued'
    | 'sending'
    | 'saved'
    | 'waiting'
    | 'failed'

export interface CellState {
    /** What DHIS2 had when the cell was loaded or last confirmed. */
    base?: string
    value?: string
    /** Text that failed checking, kept so nothing typed is lost. */
    draft?: string
    error?: string
    /** A saved value that breaks the field's rules; set on load, never blocks. */
    warning?: string
    sync: SyncState
    /** Why the cell is `waiting` or `failed`. */
    reason?: string
    source: 'person' | 'rule'
}

export interface PendingRow {
    programStageId: string
    orgUnitId: string
    enrollmentId?: string
    isNew: boolean
}

export interface PendingChange {
    sourceKey: string
    key: CellKey
    value: string | null
    base: string | null
    at: number
    row?: PendingRow
}

export type CommitResult = 'invalid' | 'unchanged' | 'queued'
