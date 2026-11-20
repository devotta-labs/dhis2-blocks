import { typedText } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type { CellKey, GridTable } from '../model/types'

/**
 * A row's name from its label cells' values (`labelFrom`), each as its field (`fieldOf`) shows it, joined by a space;
 * empty when none holds one.
 */
export const nameFrom = (
    labelFrom: ReadonlyArray<CellKey>,
    values: ReadonlyArray<string | undefined>,
    fieldOf: (key: CellKey) => Field | undefined,
    settings: ValueSettings
) =>
    labelFrom
        .flatMap((key, i) => {
            const value = values[i]
            const field = fieldOf(key)
            if (!value) {
                return []
            }
            return [
                field === undefined ? value : typedText(field, value, settings),
            ]
        })
        .join(' ')

/** Scopes an otherwise reusable header ID to one form and one table. */
export const headerDomId = (scope: string, tableId: string, headerId: string) =>
    `${scope}-${tableId}-header-${headerId}`

export const rowHeaderDomId = (scope: string, tableId: string, rowId: string) =>
    `${scope}-${tableId}-row-${rowId}`

/** For each column, the ids of the header cells above it, top row first, ready for `aria-labelledby`. */
export const columnHeaderIds = (scope: string, table: GridTable) => {
    const ids = table.columns.map<string[]>(() => [])
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
