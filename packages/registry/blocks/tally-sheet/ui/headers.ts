import type { TallyCategory, TallyLayout, TallyRow } from '../core/types'

/** One header row of the grid: a category's options, repeated under each option of the categories before it. */
export interface HeaderLevel {
    category: TallyCategory
    /** How many columns each of its headers spans. */
    span: number
    headers: ReadonlyArray<{ id: string; label: string }>
}

const product = (categories: readonly TallyCategory[]) =>
    categories.reduce((size, { options }) => size * options.length, 1)

export const headerLevels = (layout: TallyLayout) =>
    layout.categories.map((category, level) => {
        const repeat = product(layout.categories.slice(0, level))
        const headers = Array.from({ length: repeat }, () => category.options)
        return {
            category,
            span: product(layout.categories.slice(level + 1)),
            headers: headers.flat(),
        } satisfies HeaderLevel
    })

/** The DOM ids the grid gives its cells and headings, unique to one sheet. */
export const sheetIds = (scope: string) => ({
    cell: (cell: number) => `${scope}-cell-${cell}`,
    row: (row: number) => `${scope}-row-${row}`,
    group: (section: number) => `${scope}-group-${section}`,
    column: (level: number, at: number) => `${scope}-column-${level}-${at}`,
    edit: `${scope}-edit`,
})

export type SheetIds = ReturnType<typeof sheetIds>

/** The DOM id of each row's group heading, by row. */
export const groupIdsOf = (
    rowCount: number,
    sections: readonly RowSection[],
    ids: SheetIds
) => {
    const groupIds: Array<string | undefined> = Array.from(
        { length: rowCount },
        () => undefined
    )
    sections.forEach(({ group, rows }, at) => {
        if (group === undefined) return
        for (const row of rows) groupIds[row] = ids.group(at)
    })
    return groupIds
}

/** The ids of the headings over a column, outermost first. */
export const columnHeaderIds = (
    levels: readonly HeaderLevel[],
    ids: SheetIds,
    column: number
) =>
    levels.map(({ span }, level) =>
        ids.column(level, Math.floor(column / span))
    )

export interface RowSection {
    group?: string
    rows: readonly number[]
}

/**
 * The rows as drawn: the rows of each group together, under the group's heading, where its first row is; rows with
 * no group between them as they come.
 */
export const rowSections = (rows: readonly TallyRow[]) => {
    const sections: Array<{ group?: string; rows: number[] }> = []
    const byGroup = new Map<string, { group?: string; rows: number[] }>()
    rows.forEach(({ group }, at) => {
        if (group === undefined) {
            const last = sections.at(-1)
            if (last && last.group === undefined) {
                last.rows.push(at)
            } else {
                sections.push({ rows: [at] })
            }
            return
        }
        const section = byGroup.get(group)
        if (section) {
            section.rows.push(at)
            return
        }
        const made = { group, rows: [at] }
        byGroup.set(group, made)
        sections.push(made)
    })
    return sections satisfies readonly RowSection[]
}
