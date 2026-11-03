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
 * What the form says of the tables' cells, written into `cells`: the required fields of each row's record's form, or
 * why the whole record is read-only (then nothing in it is asked for).
 */
export const formEffects = (
    required: LoadedForm['required'],
    readOnlyRecords: ReadonlyMap<string, string>,
    tables: ReadonlyArray<GridTable>,
    records: ReadonlyMap<string, DataRecord>,
    cells: EffectsState['cells'] = {}
) => {
    for (const { rows, columns } of tables) {
        for (const row of rows) {
            const readOnly = readOnlyRecords.get(row.id)
            const record = records.get(row.id)
            const asked =
                readOnly === undefined && record !== undefined
                    ? required.get(formOf(record))
                    : undefined
            for (const { id } of columns) {
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

/** The columns a row has no field for, by its record's stage. */
const closedOn = (form: LoadedForm, record: DataRecord | undefined) =>
    (record === undefined
        ? undefined
        : form.closedByStage.get(record.programStageId)) ?? new Set<string>()

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
                    closedOn(form, records.get(row.id)),
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
                const closed = closedOn(form, records.get(row.id))
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
