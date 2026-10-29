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
    /**
     * Compulsory data elements per stage, and each stage's validation strategy: every stage of the program, so a save
     * checks the changes made in its other grids too.
     */
    required: ReadonlyMap<string, ReadonlySet<string>>
    strategy: ReadonlyMap<string, 'ON_COMPLETE' | 'ON_UPDATE_AND_INSERT'>
    /** Each stage's sections (section id → its data element ids); a rule hides a section only in its own stage. */
    sections: ReadonlyMap<string, ReadonlyMap<string, ReadonlyArray<string>>>
    /** Why a whole row is read-only, by row id, from Capture's edit rules. */
    readOnlyRows: ReadonlyMap<string, string>
    /** Completed rows the user may reopen (`F_UNCOMPLETE_EVENT`, stage write access, not expired). */
    canReopen: ReadonlySet<string>
    /** Stages whose events cannot be edited once completed, with the reason; for statuses saved after loading. */
    readOnlyWhenCompleted: ReadonlyMap<string, string>
    /** Whether the user may reopen what they complete (`F_UNCOMPLETE_EVENT`). */
    mayUncomplete: boolean
    rules?: RulesTarget
    newRows?: {
        tableId: string
        programStageId: string
        orgUnitId: string
        enrollmentId?: string
        /** The stage's name, for a grid of several stages to show after each new row's event date. */
        stage?: string
    }
    /** Each stage's closed columns: those of the table its events have no field for; never the event date. */
    closedByStage: ReadonlyMap<string, ReadonlySet<string>>
    /** The names of the org units the values hold, by id: an org unit cell shows its name. */
    orgUnitNames: ReadonlyMap<string, string>
}

export interface DataEntrySource {
    /**
     * Names the program (or data set) in the outbox: every grid of it shares one record per cell, and the open one
     * sends them all, including changes made in its other grids.
     */
    key: string
    /** Identifies what is loaded, for the load's cache; `key` when absent. */
    cacheKey?: string
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
    /**
     * Rows for this form's unsent new events found in the outbox after a reload: those of its `newRows` target that
     * DHIS2 does not hold yet.
     */
    restoreRows(
        engine: DataEngine,
        records: ReadonlyArray<OutboxRecord>,
        form: LoadedForm
    ): Promise<GridRow[]>
}
