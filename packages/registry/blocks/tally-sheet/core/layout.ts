import type { TallyColumn, TallyLayout, TallyOptions, TallyRow } from './types'

const BETWEEN = '\u001F'

const unique = (ids: readonly string[], what: string) => {
    const seen = new Set<string>()
    for (const id of ids) {
        if (id === '' || id.includes(BETWEEN)) {
            throw new Error(`A tally sheet ${what} has an id it cannot use.`)
        }
        if (seen.has(id)) {
            throw new Error(`Two tally sheet ${what}s share the id ${id}.`)
        }
        seen.add(id)
    }
}

/** Every column of the sheet, in the order they are drawn: the last category changes fastest. */
export const tallyColumns = (layout: TallyLayout) =>
    layout.categories.reduce<TallyColumn[]>(
        (columns, category) =>
            columns.flatMap((column) =>
                category.options.map((option) => ({
                    key:
                        column.labels.length === 0
                            ? option.id
                            : `${column.key}${BETWEEN}${option.id}`,
                    options: { ...column.options, [category.id]: option.id },
                    labels: [...column.labels, option.label],
                }))
            ),
        [{ key: '', options: {}, labels: [] }]
    )

export interface TallyIndex {
    rows: readonly TallyRow[]
    columns: readonly TallyColumn[]
    /** How many cells the sheet has: a cell is `row * columns.length + column`. */
    size: number
    cellOf(row: string, options: TallyOptions): number | undefined
    isClosed(cell: number): boolean
}

/**
 * The layout with its cells numbered, so a count is found without building a key. Throws for a layout whose ids
 * could send two cells' counts to one place.
 */
export const indexLayout = (layout: TallyLayout) => {
    unique(
        layout.rows.map(({ id }) => id),
        'row'
    )
    unique(
        layout.categories.map(({ id }) => id),
        'category'
    )
    for (const category of layout.categories) {
        unique(
            category.options.map(({ id }) => id),
            'option'
        )
    }
    const columns = tallyColumns(layout)
    const rowAt = new Map(layout.rows.map(({ id }, at) => [id, at]))
    const columnAt = new Map(columns.map(({ key }, at) => [key, at]))
    const keyOf = (options: TallyOptions) =>
        layout.categories.map(({ id }) => options[id] ?? '').join(BETWEEN)
    const closed = new Set<number>()
    for (const { row, options } of layout.closed ?? []) {
        const at = rowAt.get(row)
        if (at === undefined) continue
        columns.forEach((column, columnIndex) => {
            const within = Object.entries(options).every(
                ([category, option]) => column.options[category] === option
            )
            if (within) closed.add(at * columns.length + columnIndex)
        })
    }
    const index: TallyIndex = {
        rows: layout.rows,
        columns,
        size: layout.rows.length * columns.length,
        cellOf: (row, options) => {
            if (Object.keys(options).length !== layout.categories.length) {
                return undefined
            }
            const at = rowAt.get(row)
            const column = columnAt.get(keyOf(options))
            return at === undefined || column === undefined
                ? undefined
                : at * columns.length + column
        },
        isClosed: (cell) => closed.has(cell),
    }
    return index
}
