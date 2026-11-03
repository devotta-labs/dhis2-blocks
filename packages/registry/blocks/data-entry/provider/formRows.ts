import i18n from '@dhis2/d2-i18n'
import { summarise } from '../logic/summary'
import { cellKey, formOf, keyOf, recordsOf, recordIdOf } from '../model/types'
import type {
    CellKey,
    DataRecord,
    EventRecord,
    GridColumn,
    GridRow,
    GridTable,
} from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { LoadedForm } from '../sources/types'
import { generateUid } from '../sources/uid'
import type { EffectsState } from './context'
import type { OpenForm } from './openForm'

/** The form's summary, from its cells, their effects, its tables and its fields' names. */
export const summaryOf = (
    { store, effects, tables }: Pick<OpenForm, 'store' | 'effects' | 'tables'>,
    fieldNames: ReadonlyMap<string, string>
) =>
    summarise(
        store.getState().cells,
        effects.getState().cells,
        effects.getState().rowMessages,
        tables.getState().tables,
        fieldNames
    )

/**
 * What the form says of the rows' cells, written into `cells`: for each record the rows save to, an event's date and
 * every field of its form, shown in a column or not, the required ones, or why the whole record is read-only (then
 * nothing in it is asked for).
 */
export const formEffects = (
    { required, fieldsByForm }: Pick<LoadedForm, 'required' | 'fieldsByForm'>,
    readOnlyRecords: ReadonlyMap<string, string>,
    tables: ReadonlyArray<{
        rows: ReadonlyArray<Pick<GridRow, 'id' | 'slots'>>
    }>,
    records: ReadonlyMap<string, DataRecord>,
    cells: EffectsState['cells'] = {}
) => {
    for (const { rows } of tables) {
        for (const id of rows.flatMap(recordsOf)) {
            const readOnly = readOnlyRecords.get(id)
            const record = records.get(id)
            if (record === undefined) {
                continue
            }
            const asked =
                readOnly === undefined
                    ? required.get(formOf(record))
                    : undefined
            for (const field of [
                ...(record.kind === 'event' ? [EVENT_DATE_COLUMN] : []),
                ...(fieldsByForm.get(formOf(record)) ?? []),
            ]) {
                if (readOnly !== undefined || asked?.has(field)) {
                    cells[cellKey(id, field)] = {
                        readOnly,
                        required: asked?.has(field) ?? false,
                        messages: [],
                    }
                }
            }
        }
    }
    return cells
}

/** Whether the record's form has the field, shown in a column or not: an event's date, or one of its form's fields. */
const holds = (
    { fieldsByForm }: Pick<LoadedForm, 'fieldsByForm'>,
    record: DataRecord,
    field: string
) =>
    (record.kind === 'event' && field === EVENT_DATE_COLUMN) ||
    (fieldsByForm.get(formOf(record))?.has(field) ?? false)

/** Whether the key is a field of one of `records`, shown in a column or not: rules may assign one no column shows. */
export const isRecordField = (
    form: Pick<LoadedForm, 'fieldsByForm'>,
    records: ReadonlyMap<string, DataRecord>,
    key: string
) => {
    const record = records.get(recordIdOf(key))
    return (
        record !== undefined &&
        holds(form, record, key.slice(record.id.length + 1))
    )
}

/** The row's cells in `columns` that have no field: their record's form does not hold it; never an event's date. */
const closedOn = (
    form: LoadedForm,
    row: GridRow,
    columns: ReadonlyArray<GridColumn>,
    records: ReadonlyMap<string, DataRecord>,
    reason: string
) =>
    columns.flatMap((column): Array<[CellKey, string]> => {
        const key = keyOf(row, column)
        const record = records.get(recordIdOf(key))
        return record === undefined ||
            holds(form, record, column.fieldId ?? column.id)
            ? []
            : [[key, reason]]
    })

/**
 * The table with new rows added at its end, each closed where its record's stage has no field. A row with the id of
 * one shown replaces it in place: a register's person, back with the slot events typed before a reload.
 */
export const withRows = (
    form: LoadedForm,
    table: GridTable,
    rows: ReadonlyArray<GridRow>,
    records: ReadonlyMap<string, DataRecord>
): GridTable => {
    const notInStage = i18n.t('Not in this stage')
    const byId = new Map(rows.map((row) => [row.id, row]))
    const shown = new Set(table.rows.map(({ id }) => id))
    return {
        ...table,
        rows: [
            ...table.rows.map((row) => byId.get(row.id) ?? row),
            ...rows.filter(({ id }) => !shown.has(id)),
        ],
        closed: new Map([
            ...table.closed,
            ...rows.flatMap((row) =>
                closedOn(form, row, table.columns, records, notInStage)
            ),
        ]),
    }
}

/** The table with columns added at its end, closed in its rows whose record's stage has no field for them. */
export const withColumns = (
    form: LoadedForm,
    table: GridTable,
    columns: ReadonlyArray<GridColumn>,
    records: ReadonlyMap<string, DataRecord>
): GridTable => {
    const notInStage = i18n.t('Not in this stage')
    return {
        ...table,
        columns: [...table.columns, ...columns],
        // shortcut: new columns join the last header row only; a paging source with grouped headers needs its groups grown.
        headerRows: table.headerRows.map((cells, level, all) =>
            level < all.length - 1
                ? cells
                : [
                      ...cells,
                      ...columns.map(({ id, label }) => ({
                          id,
                          label,
                          span: 1,
                      })),
                  ]
        ),
        closed: new Map([
            ...table.closed,
            ...table.rows.flatMap((row) =>
                closedOn(form, row, columns, records, notInStage)
            ),
        ]),
    }
}

/** A new event row for the form's new-row target, in `programStageId`, with the record its cells save to. */
export const newEventRow = (
    target: NonNullable<LoadedForm['newRows']>,
    programStageId: string
) => {
    const record: EventRecord = {
        kind: 'event',
        id: generateUid(),
        programStageId,
        orgUnitId: target.orgUnitId,
        enrollmentId: target.enrollmentId,
        status: 'ACTIVE',
        isNew: true,
    }
    const row: GridRow = {
        id: record.id,
        label: i18n.t('New event'),
        stage: target.stage,
    }
    return { record, row }
}
