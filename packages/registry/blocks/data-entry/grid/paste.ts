import type { CellPosition, NavGrid } from './navigation'

/**
 * Splits what spreadsheets put on the clipboard: tab-separated cells, rows ending in \n or \r\n, one trailing line
 * break ignored, and a field holding a tab, line break or quote wrapped in double quotes with each " doubled.
 */
export const parseBlock = (text: string): string[][] => {
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let quoted = false
    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        if (quoted) {
            if (char !== '"') field += char
            else if (text[i + 1] === '"') field += text[i++]
            else quoted = false
        } else if (char === '"' && field === '') {
            quoted = true
        } else if (char === '\t') {
            row.push(field)
            field = ''
        } else if (char === '\n') {
            rows.push([...row, field])
            row = []
            field = ''
        } else if (char !== '\r' || text[i + 1] !== '\n') {
            field += char
        }
    }
    // An unterminated quote keeps what it holds rather than dropping it.
    if (text !== '' && (quoted || !text.endsWith('\n')))
        rows.push([...row, field])
    return rows
}

/** True when the text holds a tab or a line break outside quotes: more than one cell, or a copied cell's line break. */
export const isBlock = (text: string): boolean => {
    const [first, ...rest] = parseBlock(text)
    return rest.length > 0 || (first?.length ?? 0) > 1 || text.endsWith('\n')
}

/**
 * The cells a block lands on, laid out from `from`: read-only and closed cells are skipped without shifting the
 * rest, and what falls past the table's last row or column is dropped, never spilled into the next table.
 */
export const pasteTargets = (
    grid: NavGrid,
    from: CellPosition,
    block: ReadonlyArray<ReadonlyArray<string>>
): Array<{ at: CellPosition; text: string }> => {
    const { rows, columns, isEditable } = grid.tables[from.table]
    return block.flatMap((cells, r) =>
        cells.flatMap((text, c) => {
            const row = from.row + r
            const column = from.column + c
            return row < rows && column < columns && isEditable(row, column)
                ? [{ at: { table: from.table, row, column }, text }]
                : []
        })
    )
}
