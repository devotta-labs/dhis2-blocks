import type { Field } from '@/components/dhis2-value-types'

/** `<recordId>.<fieldId>`; record ids contain no dot. */
export type CellKey = `${string}.${string}`

export const cellKey = (recordId: string, fieldId: string): CellKey =>
    `${recordId}.${fieldId}`

/** The record a cell key belongs to. */
export const recordIdOf = (key: string) => key.slice(0, key.indexOf('.'))

export type EventStatus =
    | 'ACTIVE'
    | 'COMPLETED'
    | 'SCHEDULE'
    | 'SKIPPED'
    | 'VISITED'
    | 'OVERDUE'

/** A DHIS2 event that cells save to. */
export interface EventRecord {
    kind: 'event'
    id: string
    programStageId: string
    orgUnitId: string
    /** Set only in tracker programs. */
    enrollmentId?: string
    status: EventStatus
    /** The day (`YYYY-MM-DD`) a scheduled event is due: it names the row, as its event date would, until it has one. */
    scheduledAt?: string
    isNew?: boolean
    /** The register slot a new event fills. */
    slot?: string
}

/** A person's enrolment in a program; its fields are `enrolledAt` and `occurredAt`, as DHIS2 names them. */
export interface EnrollmentRecord {
    kind: 'enrollment'
    id: string
    programId: string
    trackedEntityId: string
    orgUnitId: string
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    isNew?: boolean
}

/** A tracked entity, such as a person; its fields are its attributes. */
export interface PersonRecord {
    kind: 'trackedEntity'
    id: string
    trackedEntityTypeId: string
    orgUnitId: string
    isNew?: boolean
}

/** What a group of cells saves to. */
export type DataRecord = EventRecord | EnrollmentRecord | PersonRecord

/** An event's stage, an enrolment's program, a person's tracked entity type. */
export const formOf = (record: DataRecord): string => {
    switch (record.kind) {
        case 'event':
            return record.programStageId
        case 'enrollment':
            return record.programId
        case 'trackedEntity':
            return record.trackedEntityTypeId
    }
}

export interface GridRow {
    id: string
    /** Names the row until it has an event date; then the date does, in the system calendar and format. */
    label: string
    /** The stage's name, shown after the event date in a grid of several stages. */
    stage?: string
    /** Slot name → the record the columns of that slot save to, for a row that shows cells of several records. */
    slots?: Readonly<Record<string, string>>
}

export interface GridColumn {
    id: string
    label: string
    field: Field
    /** The row's slot whose record the cells save to; without one, they save to the row's own id. */
    slot?: string
    /** The field the cells hold, when the column's id is not it. */
    fieldId?: string
}

/** The cell's key: the column's slot's record (else the row's own id) and its field (else its id). */
export const keyOf = (row: GridRow, column: GridColumn): CellKey => {
    const field = column.fieldId ?? column.id
    if (column.slot === undefined) {
        return cellKey(row.id, field)
    }
    const record = row.slots?.[column.slot]
    if (record === undefined) {
        throw new Error(`The row ${row.id} has no slot ${column.slot}`)
    }
    return cellKey(record, field)
}

/** The records a row's cells can save to: its own id, then its slots' records. */
export const recordsOf = (row: Pick<GridRow, 'id' | 'slots'>): string[] => [
    row.id,
    ...Object.values(row.slots ?? {}),
]

export interface HeaderCell {
    id: string
    label: string
    /** How many columns the heading covers. */
    span: number
    /**
     * How many heading rows it covers, its own and the ones below (default 1); those rows list no cell for its
     * columns.
     */
    rowSpan?: number
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

export interface PendingChange {
    sourceKey: string
    key: CellKey
    value: string | null
    base: string | null
    at: number
    /** What the cell saves to, as the form held it when the change was made. */
    record?: DataRecord
}

export type CommitResult = 'invalid' | 'unchanged' | 'queued'

export interface CellPlace {
    table: number
    row: number
    column: number
}

/** Where every open cell of the tables is, by key. */
export const indexCells = (
    tables: ReadonlyArray<GridTable>
): ReadonlyMap<CellKey, CellPlace> => {
    const index = new Map<CellKey, CellPlace>()
    tables.forEach(({ id, rows, columns, closed }, table) => {
        // Closed cells count too: a key two cells of a table share is a layout error, wherever it shows.
        const seen = new Set<CellKey>()
        rows.forEach((gridRow, row) => {
            columns.forEach((gridColumn, column) => {
                const key = keyOf(gridRow, gridColumn)
                if (seen.has(key)) {
                    throw new Error(
                        `Two cells of the table ${id} save to ${key}`
                    )
                }
                seen.add(key)
                if (!closed.has(key)) {
                    index.set(key, { table, row, column })
                }
            })
        })
    })
    return index
}

/** The row that shows each record. */
export const rowsByRecord = (
    tables: ReadonlyArray<GridTable>
): ReadonlyMap<string, GridRow> =>
    new Map(
        tables.flatMap(({ rows }) =>
            rows.flatMap((row) =>
                recordsOf(row).map((id) => [id, row] as const)
            )
        )
    )
