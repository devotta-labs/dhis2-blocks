import { constructFilterFn } from '@tanstack/react-table'
import {
    dataTableFilterValueSchema,
    isDataTableFilterValueEmpty,
} from './filterValue'
import type { DataTableFilterValue } from './types'

interface FilterCell {
    isEmpty: boolean
    text: string
    number: number
    strings: readonly string[]
    isTrue: boolean
    isFalse: boolean
}

const normalise = (text: string): string => text.trim().toLocaleLowerCase()

const matchesText = (
    value: Extract<DataTableFilterValue, { kind: 'text' }>,
    cell: FilterCell
): boolean => {
    const haystack = normalise(cell.text)
    const needle = normalise(value.text)
    switch (value.operator) {
        case 'contains':
            return haystack.includes(needle)
        case 'equals':
            return haystack === needle
        case 'startsWith':
            return haystack.startsWith(needle)
        case 'empty':
            return cell.isEmpty
        case 'notEmpty':
            return !cell.isEmpty
    }
}

const matchesNumber = (
    value: Extract<DataTableFilterValue, { kind: 'number' }>,
    cell: FilterCell
): boolean =>
    !cell.isEmpty &&
    Number.isFinite(cell.number) &&
    (value.min === undefined || value.min <= cell.number) &&
    (value.max === undefined || cell.number <= value.max)

const matchesDate = (
    value: Extract<DataTableFilterValue, { kind: 'date' }>,
    cell: FilterCell
): boolean => {
    const day = cell.text.slice(0, 10)
    return (
        !cell.isEmpty &&
        (value.from === undefined || value.from <= day) &&
        (value.to === undefined || day <= value.to)
    )
}

const matches = (value: DataTableFilterValue, cell: FilterCell): boolean => {
    switch (value.kind) {
        case 'text':
            return matchesText(value, cell)
        case 'number':
            return matchesNumber(value, cell)
        case 'date':
            return matchesDate(value, cell)
        case 'options':
            return cell.strings.some((entry) => value.values.includes(entry))
        case 'boolean':
            return value.value ? cell.isTrue : cell.isFalse
        case 'custom':
            return true
    }
}

/**
 * The default column filter in client mode. It understands every
 * `DataTableFilterValue`; a value it cannot parse, or an empty one, keeps the row.
 */
export const dataTableFilterFn = constructFilterFn({
    filter: (dataValue, filterValue) => {
        const parsed = dataTableFilterValueSchema.safeParse(filterValue)
        if (!parsed.success || isDataTableFilterValueEmpty(parsed.data)) {
            return true
        }
        return matches(parsed.data, {
            isEmpty:
                dataValue === null ||
                dataValue === undefined ||
                dataValue === '',
            text: String(dataValue ?? ''),
            number: Number(dataValue),
            strings: Array.isArray(dataValue)
                ? dataValue.map(String)
                : [String(dataValue)],
            isTrue: dataValue === true || dataValue === 'true',
            isFalse: dataValue === false || dataValue === 'false',
        })
    },
    autoRemove: (filterValue) => {
        if (filterValue === '') return true
        const parsed = dataTableFilterValueSchema.safeParse(filterValue)
        return parsed.success && isDataTableFilterValueEmpty(parsed.data)
    },
})
