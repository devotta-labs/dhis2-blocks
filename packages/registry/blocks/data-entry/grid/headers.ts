import type { GridTable } from '../model/types'

// Header ids repeat across tables (a column id means the same field everywhere), so the table's id is part of each.
export const headerDomId = (tableId: string, headerId: string) =>
    `data-entry-${tableId}-header-${headerId}`

export const rowHeaderDomId = (tableId: string, rowId: string) =>
    `data-entry-${tableId}-row-${rowId}`

/** For each column, the ids of the header cells above it, top row first, ready for `aria-labelledby`. */
export const columnHeaderIds = (table: GridTable): string[] => {
    const ids = table.columns.map((): string[] => [])
    for (const cells of table.headerRows) {
        let column = 0
        for (const { id, span } of cells) {
            for (const end = column + span; column < end; column++) {
                ids[column]?.push(headerDomId(table.id, id))
            }
        }
    }
    return ids.map((list) => list.join(' '))
}
