import { createFold } from './fold'
import { indexLayout } from './layout'
import type { TallyCount, TallyEntry, TallyLayout } from './types'

/**
 * What a session adds up to: a count for every cell of the sheet, zeros included, so a host can save each one over
 * the value it saved before. They follow `layout.rows`, and within a row the columns; the grid may draw a group's
 * rows together in another order. A closed cell is listed only when the log holds a count for it. Entries for a row
 * or options the layout does not have are left out: `unplacedTallyEntries` lists them. A host turns each count into
 * the value it saves, such as a DHIS2 data value.
 */
export const tallyCounts = (
    layout: TallyLayout,
    entries: readonly TallyEntry[]
) => {
    const index = indexLayout(layout)
    const fold = createFold(index)
    fold.take(entries)
    return index.rows.flatMap((row, rowAt) =>
        index.columns.flatMap((column, columnAt) => {
            const cell = rowAt * index.columns.length + columnAt
            const count = Math.max(0, fold.sumOf(cell))
            return count === 0 && index.isClosed(cell)
                ? []
                : [
                      {
                          row: row.id,
                          options: column.options,
                          count,
                      } satisfies TallyCount,
                  ]
        })
    )
}

/**
 * The entries a layout has no place for: a row it no longer has, options it does not offer, or a correction that is
 * not a whole number. They stay in the log and are counted nowhere, so a host that changes a layout mid-session can
 * tell what was left behind.
 */
export const unplacedTallyEntries = (
    layout: TallyLayout,
    entries: readonly TallyEntry[]
) => {
    const index = indexLayout(layout)
    return entries.filter((entry) => {
        if (entry.kind === 'undo') return false
        return (
            index.cellOf(entry.row, entry.options) === undefined ||
            (entry.kind !== 'tap' && !Number.isSafeInteger(entry.delta))
        )
    })
}
