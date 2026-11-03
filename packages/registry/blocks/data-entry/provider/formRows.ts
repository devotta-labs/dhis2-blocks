import i18n from '@dhis2/d2-i18n'
import { summarise } from '../logic/summary'
import { cellKey, formOf } from '../model/types'
import type {
    CellKey,
    DataRecord,
    GridColumn,
    GridRow,
    GridTable,
} from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { LoadedForm } from '../sources/types'
import type { EffectsState } from './context'
import type { OpenForm } from './openForm'

/** The form's summary, from its cells, their effects and its tables. */
export const summaryOf = ({
    store,
    effects,
    tables,
}: Pick<OpenForm, 'store' | 'effects' | 'tables'>) =>
    summarise(
        store.getState().cells,
        effects.getState().cells,
        effects.getState().rowMessages,
        tables.getState().tables
    )

/**
 * What the form says of the rows' cells, written into `cells`: for each row's record, its event date and every field of
 * its form, shown in a column or not, the required ones, or why the whole record is read-only (then nothing in it is
 * asked for).
 */
export const formEffects = (
    { required, fieldsByForm }: Pick<LoadedForm, 'required' | 'fieldsByForm'>,
    readOnlyRecords: ReadonlyMap<string, string>,
    tables: ReadonlyArray<GridTable>,
    records: ReadonlyMap<string, DataRecord>,
    cells: EffectsState['cells'] = {}
) => {
    for (const { rows } of tables) {
        for (const row of rows) {
            const readOnly = readOnlyRecords.get(row.id)
            const record = records.get(row.id)
            if (record === undefined) {
                continue
            }
            const asked =
                readOnly === undefined
                    ? required.get(formOf(record))
                    : undefined
            for (const id of [
                EVENT_DATE_COLUMN,
                ...(fieldsByForm.get(formOf(record)) ?? []),
            ]) {
                if (readOnly !== undefined || asked?.has(id)) {
                    cells[cellKey(row.id, id)] = {
                        readOnly,
                        required: asked?.has(id) ?? false,
                        messages: [],
                    }
                }
            }
        }
    }
    return cells
}

/** The columns a row has no field for: those its record's form does not hold; never the event date. */
const closedOn = (
    form: LoadedForm,
    columns: ReadonlyArray<GridColumn>,
    record: DataRecord | undefined
) => {
    const fields =
        record === undefined ? undefined : form.fieldsByForm.get(formOf(record))
    return new Set(
        record === undefined
            ? []
            : columns
                  .map(({ id }) => id)
                  .filter((id) => id !== EVENT_DATE_COLUMN && !fields?.has(id))
    )
}

/** The table with new rows added at its end, each closed where its record's stage has no field. */
export const withRows = (
    form: LoadedForm,
    table: GridTable,
    rows: ReadonlyArray<GridRow>,
    records: ReadonlyMap<string, DataRecord>
): GridTable => {
    const notInStage = i18n.t('Not in this stage')
    return {
        ...table,
        rows: [...table.rows, ...rows],
        closed: new Map([
            ...table.closed,
            ...rows.flatMap((row) =>
                Array.from(
                    closedOn(form, table.columns, records.get(row.id)),
                    (column): [CellKey, string] => [
                        cellKey(row.id, column),
                        notInStage,
                    ]
                )
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
            ...table.rows.flatMap((row) => {
                const closed = closedOn(form, columns, records.get(row.id))
                return columns
                    .filter(({ id }) => closed.has(id))
                    .map(({ id }): [CellKey, string] => [
                        cellKey(row.id, id),
                        notInStage,
                    ])
            }),
        ]),
    }
}
