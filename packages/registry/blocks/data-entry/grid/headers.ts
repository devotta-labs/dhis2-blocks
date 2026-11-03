import { typedText } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { recordIdOf } from '../model/types'
import type { CellKey, DataRecord, GridRow, GridTable } from '../model/types'

const EVENT_DATE = { valueType: 'DATE' }

/**
 * What names a row: once it has an event date (or, until then, the day its record is scheduled for), that date in the
 * system calendar and date format (and its stage in a grid of several stages); before, the label its source gave it.
 * A row named by its cells (`labelFrom`) has the label its source gave it until they hold a name (`nameFrom`).
 */
export const rowLabel = (
    row: GridRow,
    record: DataRecord | undefined,
    date: string | undefined,
    settings: ValueSettings
) => {
    if (row.labelFrom !== undefined) {
        return row.label
    }
    const day =
        date ?? (record?.kind === 'event' ? record.scheduledAt : undefined)
    if (day === undefined) {
        return row.label
    }
    const shown = typedText(EVENT_DATE, day, settings)
    return row.stage === undefined ? shown : `${shown} · ${row.stage}`
}

/** Each field a column shows, by field id: what a row's label cells are shown through. */
export const columnFields = (
    tables: ReadonlyArray<GridTable>
): ReadonlyMap<string, Field> =>
    new Map(
        tables.flatMap(({ columns }) =>
            columns.map(({ id, fieldId = id, field }) => [fieldId, field])
        )
    )

/**
 * A row's name from its label cells' values (`labelFrom`), each as its column shows it, joined by a space; empty when
 * none holds one.
 */
export const nameFrom = (
    labelFrom: ReadonlyArray<CellKey>,
    values: ReadonlyArray<string | undefined>,
    fields: ReadonlyMap<string, Field>,
    settings: ValueSettings
) =>
    labelFrom
        .flatMap((key, i) => {
            const value = values[i]
            const field = fields.get(key.slice(recordIdOf(key).length + 1))
            if (!value) {
                return []
            }
            return [
                field === undefined ? value : typedText(field, value, settings),
            ]
        })
        .join(' ')

// Header ids repeat across tables (a column id means the same field everywhere), so the table's id is part of each;
// `scope` is the form's, so two forms on a page never share one.
export const headerDomId = (scope: string, tableId: string, headerId: string) =>
    `${scope}-${tableId}-header-${headerId}`

export const rowHeaderDomId = (scope: string, tableId: string, rowId: string) =>
    `${scope}-${tableId}-row-${rowId}`

/** For each column, the ids of the header cells above it, top row first, ready for `aria-labelledby`. */
export const columnHeaderIds = (scope: string, table: GridTable): string[] => {
    const ids = table.columns.map((): string[] => [])
    // The heading row below which each column is free again; a heading taller than one row holds its columns till then.
    const coveredUntil = ids.map(() => 0)
    table.headerRows.forEach((cells, level) => {
        let column = 0
        for (const { id, span, rowSpan = 1 } of cells) {
            while ((coveredUntil[column] ?? 0) > level) {
                column++
            }
            for (const end = column + span; column < end; column++) {
                ids[column]?.push(headerDomId(scope, table.id, id))
                coveredUntil[column] = level + rowSpan
            }
        }
    })
    return ids.map((list) => list.join(' '))
}
