import i18n from '@dhis2/d2-i18n'
import { cellKey } from '@/components/spreadsheet'
import type { CellKey, GridTable } from '@/components/spreadsheet'
import type { TrackerEffects, TrackerEffectsState } from '../logic/effects'
import { summarise } from '../logic/summary'
import {
    formOf,
    trackerKeyOf,
    recordsOf,
    recordIdOf,
    fieldIdOfKey,
} from '../model/types'
import type {
    DataRecord,
    EventRecord,
    TrackerColumn,
    TrackerRow,
} from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { LoadedForm } from '../sources/types'
import { generateUid } from '../sources/uid'
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

const FILES: ReadonlySet<string> = new Set(['FILE_RESOURCE', 'IMAGE'])

/**
 * Why a field of the record is read-only whatever else is said of it: a person's file or image is uploaded in their own
 * form, as the file editor uploads an event's.
 */
const editedElsewhere = (
    { fields }: Pick<LoadedForm, 'fields'>,
    record: DataRecord,
    field: string
) =>
    record.kind === 'trackedEntity' &&
    FILES.has(fields.get(field)?.valueType ?? '')
        ? i18n.t('Edit this field in its own form')
        : undefined

/** `effects`, read-only when the field is edited elsewhere (`editedElsewhere`) and nothing else locks it. */
export const lockedElsewhere = (
    form: Pick<LoadedForm, 'fields'>,
    record: DataRecord,
    field: string,
    effects: TrackerEffects
): TrackerEffects => {
    const elsewhere = effects.readOnly ?? editedElsewhere(form, record, field)
    return elsewhere === effects.readOnly
        ? effects
        : { ...effects, readOnly: elsewhere }
}

/**
 * What the form says of the rows' cells, written into `cells`: for each record the rows save to, an event's date and
 * every field of its form, shown in a column or not, the required ones, those edited elsewhere (`editedElsewhere`), or
 * why the whole record is read-only (then nothing in it is asked for).
 */
export const formEffects = (
    form: Pick<LoadedForm, 'required' | 'fieldsByForm' | 'fields'>,
    readOnlyRecords: ReadonlyMap<string, string>,
    tables: ReadonlyArray<{
        rows: ReadonlyArray<Pick<TrackerRow, 'id' | 'slots'>>
    }>,
    records: ReadonlyMap<string, DataRecord>,
    cells: TrackerEffectsState['cells'] = {}
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
                    ? form.required.get(formOf(record))
                    : undefined
            for (const field of [
                ...(record.kind === 'event' ? [EVENT_DATE_COLUMN] : []),
                ...(form.fieldsByForm.get(formOf(record)) ?? []),
            ]) {
                const locked = readOnly ?? editedElsewhere(form, record, field)
                if (locked !== undefined || asked?.has(field)) {
                    cells[cellKey(id, field)] = {
                        readOnly: locked,
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
    return record !== undefined && holds(form, record, fieldIdOfKey(key))
}

/** The row's cells in `columns` that have no field: their record's form does not hold it; never an event's date. */
const closedOn = (
    form: LoadedForm,
    row: TrackerRow,
    columns: ReadonlyArray<TrackerColumn>,
    records: ReadonlyMap<string, DataRecord>,
    reason: string
) =>
    columns.flatMap((column): Array<[CellKey, string]> => {
        const key = trackerKeyOf(row, column)
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
    table: GridTable<TrackerRow, TrackerColumn>,
    rows: ReadonlyArray<TrackerRow>,
    records: ReadonlyMap<string, DataRecord>
): GridTable<TrackerRow, TrackerColumn> => {
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
    table: GridTable<TrackerRow, TrackerColumn>,
    columns: ReadonlyArray<TrackerColumn>,
    records: ReadonlyMap<string, DataRecord>
): GridTable<TrackerRow, TrackerColumn> => {
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
    const row: TrackerRow = {
        id: record.id,
        label: i18n.t('New event'),
        stage: target.stage,
    }
    return { record, row }
}
