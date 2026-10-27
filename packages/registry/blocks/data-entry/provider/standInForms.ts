import { createStore } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { cellKey } from '../model/types'
import type { GridTable } from '../model/types'
import type { LoadedForm } from '../sources/types'
import { createDataEntryStore } from '../store/store'
import { refusalOf } from './completion'
import { FORM_MESSAGES } from './context'
import type { EffectsState } from './context'
import { formEffects } from './formRows'
import type { OpenForm } from './openForm'
import { signedInAsOther } from './signedIn'

/** What the provider shows until a form is open: no tables, no cells, nothing to do. */
export const emptyForm = (): OpenForm => ({
    store: createDataEntryStore({
        tables: [],
        values: new Map(),
        settings: { calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' },
        enqueue: () => {},
    }),
    effects: createStore<EffectsState>()(() => ({
        cells: {},
        rowMessages: new Map(),
        rowNotes: new Map(),
    })),
    tables: createStore<{ tables: ReadonlyArray<GridTable> }>()(() => ({
        tables: [],
    })),
    readOnlyRows: new Map(),
    beforeComplete: new Set(),
    newRowTables: new Set(),
    addRow: () => {},
    complete: async () => [],
    reopen: async () => [],
    downloadUnsent: () => {},
    discardFailed: async () => {},
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
    const readOnlyRows = new Map(
        form.tables.flatMap(({ rows }) =>
            rows.map(({ id }): [string, string] => [id, reason])
        )
    )
    const refuse = async (rowId: string) => [
        refusalOf(sourceKey, cellKey(rowId, 'status'), reason),
    ]
    return {
        ...emptyForm(),
        store: createDataEntryStore({
            tables: form.tables,
            values: form.values,
            settings,
            enqueue: () => {},
        }),
        effects: createStore<EffectsState>()(() => ({
            cells: formEffects(form.required, readOnlyRows, form.tables),
            rowMessages: new Map([
                [
                    FORM_MESSAGES,
                    [{ kind: 'error', text: reason, source: 'server' }],
                ],
            ]),
            rowNotes: new Map(),
        })),
        tables: createStore<{ tables: ReadonlyArray<GridTable> }>()(() => ({
            tables: form.tables,
        })),
        readOnlyRows,
        complete: refuse,
        reopen: refuse,
    }
}
