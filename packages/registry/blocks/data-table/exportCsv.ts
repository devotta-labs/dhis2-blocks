import { dataTableColumnLabel } from './columnLabel'
import type {
    DataTableCell,
    DataTableInstance,
    DataTableRow,
} from './tableHook'

export interface DataTableCsvOptions<TData> {
    /** 'all' (default): every row after filtering and sorting, before pagination (in server mode: the loaded page). 'page': the current page. 'selected': selected loaded rows. */
    rows?: 'all' | 'page' | 'selected'
    /** Cell text. Default: `String(cell.getValue() ?? '')`, arrays joined with `; `. */
    formatValue?: (cell: DataTableCell<TData>) => string
    /** Default ','. */
    delimiter?: string
}

/** Columns that hold controls, not data. */
const utilityIds: readonly string[] = ['select', 'expand', 'actions']

const formulaStart = /^[=+\-@\t\r]/
const plainNumber = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i

const defaultFormat = <TData>(cell: DataTableCell<TData>): string => {
    const value = cell.getValue()
    if (Array.isArray(value)) {
        return value.map((item) => String(item ?? '')).join('; ')
    }
    return String(value ?? '')
}

const csvField = (text: string, delimiter: string): string => {
    // A spreadsheet would run a leading =, +, -, @, tab or CR as a formula;
    // a plain number such as -5 is data.
    const guarded =
        formulaStart.test(text) && !plainNumber.test(text) ? `'${text}` : text
    return guarded.includes(delimiter) || /["\r\n]/.test(guarded)
        ? `"${guarded.replaceAll('"', '""')}"`
        : guarded
}

/** Grouped rows give way to their leaf rows; each row appears once. */
const leafRows = <TData>(
    rows: readonly DataTableRow<TData>[]
): DataTableRow<TData>[] => {
    const seen = new Set<string>()
    const leaves: DataTableRow<TData>[] = []
    for (const row of rows) {
        const candidates = row.getIsGrouped() ? row.getLeafRows() : [row]
        for (const candidate of candidates) {
            if (candidate.getIsGrouped() || seen.has(candidate.id)) continue
            seen.add(candidate.id)
            leaves.push(candidate)
        }
    }
    return leaves
}

const exportedRows = <TData>(
    table: DataTableInstance<TData>,
    rows: 'all' | 'page' | 'selected'
): DataTableRow<TData>[] => {
    switch (rows) {
        case 'page':
            return leafRows(table.getRowModel().rows)
        case 'selected':
            // In display order; selected rows the filters hide come last.
            return leafRows([
                ...table
                    .getPrePaginatedRowModel()
                    .flatRows.filter((row) => row.getIsSelected()),
                ...table.getSelectedRowModel().flatRows,
            ])
        case 'all':
            return leafRows(table.getPrePaginatedRowModel().rows)
    }
}

/** The visible data columns and rows as RFC 4180 CSV with CRLF line endings. */
export const dataTableToCsv = <TData>(
    table: DataTableInstance<TData>,
    options: DataTableCsvOptions<TData> = {}
): string => {
    const {
        rows = 'all',
        formatValue = defaultFormat,
        delimiter = ',',
    } = options
    const columns = [
        ...table.getStartVisibleLeafColumns(),
        ...table.getCenterVisibleLeafColumns(),
        ...table.getEndVisibleLeafColumns(),
    ].filter((column) => !utilityIds.includes(column.id))
    const lines = [
        columns.map((column) =>
            csvField(dataTableColumnLabel(column), delimiter)
        ),
        ...exportedRows(table, rows).map((row) => {
            const cells = row.getAllCells()
            return columns.map((column) => {
                const cell = cells.find(
                    (candidate) => candidate.column.id === column.id
                )
                return cell === undefined
                    ? ''
                    : csvField(formatValue(cell), delimiter)
            })
        }),
    ]
    return lines.map((fields) => fields.join(delimiter)).join('\r\n')
}

/** Downloads the table as a UTF-8 CSV file (with a BOM, for spreadsheets). */
export const downloadDataTableCsv = <TData>(
    table: DataTableInstance<TData>,
    filename: string,
    options?: DataTableCsvOptions<TData>
): void => {
    const csv = dataTableToCsv(table, options)
    const blob = new Blob(['﻿', csv], {
        type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename.toLowerCase().endsWith('.csv')
        ? filename
        : `${filename}.csv`
    link.style.display = 'none'
    document.body.append(link)
    link.click()
    link.remove()
    // Revoked after the click has started the download.
    setTimeout(() => URL.revokeObjectURL(url))
}
