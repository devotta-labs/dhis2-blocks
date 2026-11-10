import type { Field } from '@/components/dhis2-value-types'
import { cellKey } from '@/components/spreadsheet'
import type { CellKey, GridColumn, GridRow } from '@/components/spreadsheet'

/** The record a cell key belongs to. */
export const recordIdOf = (key: string) => key.slice(0, key.indexOf('.'))

/** The field a cell key belongs to. */
export const fieldIdOfKey = (key: string) => key.slice(key.indexOf('.') + 1)

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
    /** The register slot the event fills. */
    slot?: string
    /** Values a new event is created with that no column shows: a `where` slot's (data element id → code). */
    createdWith?: Readonly<Record<string, string>>
    /** A new person's event: that person, so a reload can rebuild their row, with its ids, from the outbox alone. */
    trackedEntityId?: string
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

/** A row of a tracker grid: an event, or a person whose cells save to several records. */
export interface TrackerRow extends GridRow {
    /** The stage's name, shown after the event date in a grid of several stages. */
    stage?: string
    /** Slot name → the record the columns of that slot save to, for a row that shows cells of several records. */
    slots?: Readonly<Record<string, string>>
}

export interface TrackerColumn extends GridColumn {
    /** What the cells hold, for a layout of your own to hand each `Cell`; the grid asks the cell store instead. */
    field: Field
    /** The row's slot whose record the cells save to; without one, they save to the row's own id. */
    slot?: string
    /** The field the cells hold, when the column's id is not it. */
    fieldId?: string
}

/** The cell's key: the column's slot's record (else the row's own id) and its field (else its id). */
export const trackerKeyOf = (
    row: TrackerRow,
    column: TrackerColumn
): CellKey => {
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

/** The records a row's cells can save to: its own id, then its slots' records, each once. */
export const recordsOf = (row: Pick<TrackerRow, 'id' | 'slots'>): string[] => [
    ...new Set([row.id, ...Object.values(row.slots ?? {})]),
]

export interface PendingChange {
    sourceKey: string
    key: CellKey
    value: string | null
    base: string | null
    at: number
    /** What the cell saves to, as the form held it when the change was made. */
    record?: DataRecord
}

/** The row that shows each record. */
export const rowsByRecord = (
    tables: ReadonlyArray<{ rows: ReadonlyArray<TrackerRow> }>
): ReadonlyMap<string, TrackerRow> =>
    new Map(
        tables.flatMap(({ rows }) =>
            rows.flatMap((row) =>
                recordsOf(row).map((id) => [id, row] as const)
            )
        )
    )
