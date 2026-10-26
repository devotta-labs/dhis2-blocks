import type { useDataEngine } from '@dhis2/app-runtime'
import type { CellKey, GridRow, GridTable } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import type { SaveOutcome } from '../outbox/sync'

export type DataEngine = ReturnType<typeof useDataEngine>

export interface RulesTarget {
    programId: string
    programStageIds: string[]
    tracker: boolean
    enrollmentIds: string[]
}

export interface LoadedForm {
    tables: GridTable[]
    values: ReadonlyMap<CellKey, string>
    /** Compulsory data elements per stage, and each stage's validation strategy. */
    required: ReadonlyMap<string, ReadonlySet<string>>
    strategy: ReadonlyMap<string, 'ON_COMPLETE' | 'ON_UPDATE_AND_INSERT'>
    /** Each stage's sections (section id → its data element ids); a rule hides a section only in its own stage. */
    sections: ReadonlyMap<string, ReadonlyMap<string, ReadonlyArray<string>>>
    /** Why a whole row is read-only, by row id, from Capture's edit rules. */
    readOnlyRows: ReadonlyMap<string, string>
    /** Completed rows the user may reopen (`F_UNCOMPLETE_EVENT`, stage write access, not expired). */
    canReopen: ReadonlySet<string>
    rules?: RulesTarget
    newRows?: {
        tableId: string
        programStageId: string
        orgUnitId: string
        enrollmentId?: string
        /** The table's columns outside `programStageId`, closed on new rows; never the event date. */
        closedColumns: ReadonlySet<string>
    }
}

export interface DataEntrySource {
    /** Identifies the loaded context in query keys and the outbox. */
    key: string
    load(engine: DataEngine, signal?: AbortSignal): Promise<LoadedForm>
    save(
        engine: DataEngine,
        records: ReadonlyArray<OutboxRecord>,
        form: LoadedForm
    ): Promise<SaveOutcome[]>
    setStatus(
        engine: DataEngine,
        rowId: string,
        status: 'COMPLETED' | 'ACTIVE',
        form: LoadedForm
    ): Promise<SaveOutcome[]>
    /** Rows for unsent new events found in the outbox after a reload. */
    restoreRows(records: ReadonlyArray<OutboxRecord>): GridRow[]
}
