import { createStore } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { cellKey } from '../model/types'
import type { LoadedForm } from '../sources/types'
import { createDataEntryStore } from '../store/store'
import { refusalOf } from './completion'
import { FORM_MESSAGES } from './context'
import type { EffectsState } from './context'
import { formEffects } from './formRows'
import type { FormTables, OpenForm } from './openForm'
import { signedInAsOther } from './signedIn'

/** What the provider shows until a form is open: no tables, no cells, nothing to do. */
export const emptyForm = (): OpenForm => ({
    store: createDataEntryStore({
        fields: new Map(),
        values: new Map(),
        settings: { calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' },
        enqueue: () => {},
    }),
    effects: createStore<EffectsState>()(() => ({
        cells: {},
        rowMessages: new Map(),
        rowNotes: new Map(),
    })),
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
})

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
    const refuse = async (rowId: string) => [
        refusalOf(sourceKey, cellKey(rowId, 'status'), reason),
    ]
    return {
        ...emptyForm(),
        store: createDataEntryStore({
            fields: form.fields,
            values: form.values,
            settings,
            enqueue: () => {},
        }),
        effects: createStore<EffectsState>()(() => ({
            cells: formEffects(
                form,
                readOnlyRecords,
                form.tables,
                form.records
            ),
            rowMessages: new Map([
                [
                    FORM_MESSAGES,
                    [{ kind: 'error', text: reason, source: 'server' }],
                ],
            ]),
            rowNotes: new Map(),
        })),
        tables: createStore<FormTables>()(() => ({
            tables: form.tables,
            records: form.records,
        })),
        readOnlyRecords,
        complete: refuse,
        reopen: refuse,
    }
}
