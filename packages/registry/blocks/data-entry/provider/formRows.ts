import i18n from '@dhis2/d2-i18n'
import { cellKey } from '../model/types'
import type { CellKey, GridRow, GridTable, PendingRow } from '../model/types'
import type { LoadedForm } from '../sources/types'
import type { EffectsState } from './context'

export const rowIdOf = (key: string) => key.slice(0, key.indexOf('.'))

/** What a change says of its row, for a source to save it; a row with no stage or org unit says nothing. */
export const pendingRow = (row: GridRow | undefined): PendingRow | undefined =>
    row?.programStageId === undefined || row.orgUnitId === undefined
        ? undefined
        : {
              programStageId: row.programStageId,
              orgUnitId: row.orgUnitId,
              enrollmentId: row.enrollmentId,
              isNew: row.isNew ?? false,
          }

/**
 * What the form says of the tables' cells, written into `cells`: the required fields of each row's stage, or why the
 * whole row is read-only (then nothing in it is asked for).
 */
export const formEffects = (
    required: LoadedForm['required'],
    readOnlyRows: ReadonlyMap<string, string>,
    tables: ReadonlyArray<GridTable>,
    cells: EffectsState['cells'] = {}
) => {
    for (const { rows, columns } of tables) {
        for (const row of rows) {
            const readOnly = readOnlyRows.get(row.id)
            const asked =
                readOnly === undefined && row.programStageId !== undefined
                    ? required.get(row.programStageId)
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

/** The columns a new row has no field for, by its stage. */
const closedOnNewRow = (form: LoadedForm, row: GridRow) =>
    (row.programStageId === undefined
        ? undefined
        : form.closedByStage.get(row.programStageId)) ?? new Set<string>()

/** The table with new rows added at its end, each closed where its stage has no field. */
export const withRows = (
    form: LoadedForm,
    table: GridTable,
    rows: ReadonlyArray<GridRow>
): GridTable => {
    const notInStage = i18n.t('Not in this stage')
    return {
        ...table,
        rows: [...table.rows, ...rows],
        closed: new Map([
            ...table.closed,
            ...rows.flatMap((row) =>
                Array.from(
                    closedOnNewRow(form, row),
                    (column): [CellKey, string] => [
                        cellKey(row.id, column),
                        notInStage,
                    ]
                )
            ),
        ]),
    }
}
