import { typedText } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { GridRow, GridTable } from '../model/types'

const EVENT_DATE = { valueType: 'DATE' }

/**
 * What names a row: once it has an event date (or, until then, the day it is scheduled for), that date in the system
 * calendar and date format (and its stage in a grid of several stages); before, the label its source gave it.
 */
export const rowLabel = (
    row: GridRow,
    date: string | undefined,
    settings: ValueSettings
) => {
    const day = date ?? row.scheduledAt
    if (day === undefined) {
        return row.label
    }
    const shown = typedText(EVENT_DATE, day, settings)
    return row.stage === undefined ? shown : `${shown} · ${row.stage}`
}

// Header ids repeat across tables (a column id means the same field everywhere), so the table's id is part of each;
// `scope` is the form's, so two forms on a page never share one.
export const headerDomId = (scope: string, tableId: string, headerId: string) =>
    `${scope}-${tableId}-header-${headerId}`

export const rowHeaderDomId = (scope: string, tableId: string, rowId: string) =>
    `${scope}-${tableId}-row-${rowId}`

/** For each column, the ids of the header cells above it, top row first, ready for `aria-labelledby`. */
export const columnHeaderIds = (scope: string, table: GridTable): string[] => {
    const ids = table.columns.map((): string[] => [])
    for (const cells of table.headerRows) {
        let column = 0
        for (const { id, span } of cells) {
            for (const end = column + span; column < end; column++) {
                ids[column]?.push(headerDomId(scope, table.id, id))
            }
        }
    }
    return ids.map((list) => list.join(' '))
}
