import { typedText } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type {
    TrackerDataEntrySource,
    LoadedForm,
    NewRow,
} from '../sources/types'
import type { Growing } from './appendPage'
import { formEffects, newEventRow, withRows } from './formRows'

/** A new event of the form's new-row stage, when it has one. */
const eventRow = (
    target: NonNullable<LoadedForm['newRows']>
): NewRow | undefined => {
    if (target.programStageId === undefined) {
        return undefined
    }
    const { record, row } = newEventRow(target, target.programStageId)
    return { row, records: [record], values: new Map() }
}

/**
 * Adds a new row at the end of a table that takes them: the source's own (a register's person, enrolment and slot
 * events), else an event of the form's new-row stage. The values it starts with, such as reserved ids, are committed
 * as a rule's are: saved with the row, and not the person's to undo.
 */
export const addRow = (
    { form, store, effects, tables, readOnlyRecords }: Growing,
    source: Pick<TrackerDataEntrySource, 'newRow'>,
    settings: ValueSettings,
    tableId: string
) => {
    const { newRows } = form
    const table = tables.getState().tables.find(({ id }) => id === tableId)
    if (newRows?.tableId !== tableId || table === undefined) {
        return
    }
    const made = source.newRow?.(tableId) ?? eventRow(newRows)
    if (made === undefined) {
        return
    }
    const known = new Map(tables.getState().records)
    for (const record of made.records) {
        known.set(record.id, record)
    }
    // Before its cells' effects and the store's lock read them.
    for (const [id, reason] of made.readOnlyRecords ?? []) {
        readOnlyRecords.set(id, reason)
    }
    effects.setState(({ cells }) => ({
        cells: formEffects(
            form,
            readOnlyRecords,
            [{ ...table, rows: [made.row] }],
            known,
            { ...cells }
        ),
    }))
    if (made.messages !== undefined) {
        const { messages } = made
        effects.setState(({ rowMessages }) => ({
            rowMessages: new Map([...rowMessages, ...messages]),
        }))
    }
    tables.setState(({ tables: all }) => ({
        tables: all.map((each) =>
            each.id === tableId ? withRows(form, each, [made.row], known) : each
        ),
        records: known,
    }))
    // Once its records are known: each change keeps the record it saves to.
    store.getState().commitMany(
        [...made.values].map(([key, value]) => {
            const field = store.getState().fieldOf(key)
            return {
                key,
                text:
                    field === undefined
                        ? value
                        : typedText(field, value, settings),
            }
        }),
        'rule'
    )
}
