export interface UnsentLine {
    form: string
    row: string
    field: string
    value: string
    state: string
    reason: string
}

const COLUMNS = ['form', 'row', 'field', 'value', 'state', 'reason'] as const

const quote = (text: string) =>
    /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text

const defuse = (text: string) =>
    /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)
        ? `'${text}`
        : text

const csvRow = (cells: ReadonlyArray<string>) => `${cells.join(',')}\n`

/** One line per unsent change, with enough context to enter it again by hand. */
export const unsentChangesCsv = (lines: ReadonlyArray<UnsentLine>) =>
    csvRow(COLUMNS) +
    lines
        .map((line) =>
            csvRow(COLUMNS.map((column) => quote(defuse(line[column]))))
        )
        .join('')
