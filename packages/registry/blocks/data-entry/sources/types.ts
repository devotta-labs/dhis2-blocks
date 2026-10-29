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
    /**
     * Whether the program has any rules, asked beside the form's first load (false if that failed or had not answered
     * when the form was ready). Only a program that has loads the rule engine.
     */
    hasRules: boolean
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
    /**
     * Each stage's closed columns: those its events have no field for, of every column the table has or a page may add;
     * never the event date.
     */
    closedByStage: ReadonlyMap<string, ReadonlySet<string>>
    /** The names of the org units the values hold, by id: an org unit cell shows its name. */
    orgUnitNames: ReadonlyMap<string, string>
    /** The names of the files and images the values hold, by id: a file cell shows its name. */
    fileNames: ReadonlyMap<string, string>
    /** Whether a next page may hold more rows: this one came back full. */
    hasMore: boolean
}

/**
 * The rows of a page after the first, per table id, with their columns: those new to a table join it at its end. Its
 * names, read-only rows and reopenable rows are those of its own rows.
 */
export type FormPage = Pick<
    LoadedForm,
    | 'tables'
    | 'values'
    | 'readOnlyRows'
    | 'canReopen'
    | 'orgUnitNames'
    | 'fileNames'
    | 'hasMore'
>

export interface DataEntrySource {
    /**
     * Names the program (or data set) in the outbox: every grid of it shares one record per cell, and the open one
     * sends them all, including changes made in its other grids.
     */
    key: string
    /** Identifies what is loaded, for the load's cache; `key` when absent. */
    cacheKey?: string
    load(engine: DataEngine, signal?: AbortSignal): Promise<LoadedForm>
    /** Page 2, 3, …: the rows after the load's, in its order and page size. */
    loadPage?(
        engine: DataEngine,
        page: number,
        signal?: AbortSignal
    ): Promise<FormPage>
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
