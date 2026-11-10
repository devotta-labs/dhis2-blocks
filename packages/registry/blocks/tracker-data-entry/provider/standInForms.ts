import { createStore } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { cellKey, createCellStore } from '@/components/spreadsheet'
import type { LoadedForm } from '../sources/types'
import { refusalOf } from './completion'
import { FORM_MESSAGES } from '../logic/effects'
import type { TrackerEffectsState } from '../logic/effects'
import { formEffects } from './formRows'
import type { FormTables, OpenForm } from './openForm'
import { signedInAsOther } from './signedIn'

/** What the provider shows until a form is open: no tables, no cells, nothing to do. */
export const emptyForm = (): OpenForm => {
    const effects = createStore<TrackerEffectsState>()(() => ({
        cells: {},
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))
    return {
        store: createCellStore({
            fields: new Map(),
            values: new Map(),
            settings: { calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' },
            enqueue: () => {},
            annotations: effects,
        }),
        effects,
        tables: createStore<FormTables>()(() => ({
            tables: [],
            records: new Map(),
        })),
        readOnlyRecords: new Map(),
        beforeComplete: new Set(),
        newRowTables: new Set(),
        addRow: () => {},
        complete: async () => [],
        reopen: async () => [],
        downloadUnsent: () => {},
        discardFailed: async () => {},
        append: async () => {},
        close: () => {},
    }
}

/**
 * What the provider shows once someone else has signed in: the form as DHIS2 had it when loaded, without this user's
 * unsent changes, every cell read-only with the reason, which the summary says too. Nothing is written or sent.
 */
export const lockedForm = (
    form: LoadedForm,
    settings: ValueSettings,
    sourceKey: string
): OpenForm => {
    const reason = signedInAsOther()
    // Every record the form holds, a slot's too: its cells are read-only as well.
    const readOnlyRecords = new Map(
        [...form.records.keys()].map((id): [string, string] => [id, reason])
    )
    const refuse = async (recordId: string) => [
        refusalOf(sourceKey, cellKey(recordId, 'status'), reason),
    ]
    const effects = createStore<TrackerEffectsState>()(() => ({
        cells: formEffects(form, readOnlyRecords, form.tables, form.records),
        rowMessages: new Map([
            [
                FORM_MESSAGES,
                [{ tone: 'error', text: reason, source: 'server' }],
            ],
        ]),
        rowNotes: new Map(form.rowNotes),
    }))
    return {
        ...emptyForm(),
        store: createCellStore({
            fields: form.fields,
            values: form.values,
            settings,
            enqueue: () => {},
            annotations: effects,
        }),
        effects,
        tables: createStore<FormTables>()(() => ({
            tables: form.tables,
            records: form.records,
        })),
        readOnlyRecords,
        complete: refuse,
        reopen: refuse,
    }
}
