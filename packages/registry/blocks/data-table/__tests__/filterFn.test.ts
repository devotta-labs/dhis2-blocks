import type { ColumnFilter } from '@tanstack/react-table'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import {
    createDataTableColumnHelper,
    dataTableFilterFn,
    useDataTable,
    type DataTableFilterValue,
    type DataTableRow,
} from '..'

type CellValue = string | number | boolean | null | undefined | string[]

interface Entry {
    id: string
    value: CellValue
}

const column = createDataTableColumnHelper<Entry>()
const columns = column.columns([column.accessor('value', {})])

/** A real row from a real table, rendered once on the server. */
const rowWith = (value: CellValue): DataTableRow<Entry> => {
    const rows: DataTableRow<Entry>[] = []
    const Table = () => {
        const table = useDataTable({
            data: [{ id: 'entry', value }],
            columns,
            getRowId: (entry) => entry.id,
        })
        rows.push(...table.getCoreRowModel().rows)
        return null
    }
    renderToString(createElement(Table))
    const [row] = rows
    if (!row) throw new Error('The table rendered no row.')
    return row
}

const keeps = (value: CellValue, filter: DataTableFilterValue): boolean =>
    dataTableFilterFn(rowWith(value), 'value', filter)

/** Takes a whole filter entry, so any stored value can be passed. */
const keepsStored = (value: CellValue, entry: ColumnFilter): boolean =>
    dataTableFilterFn(rowWith(value), 'value', entry.value)

const text = (
    operator: Extract<DataTableFilterValue, { kind: 'text' }>['operator'],
    value: string
): DataTableFilterValue => ({ kind: 'text', operator, text: value })

describe('text', () => {
    it('contains: case-insensitive and trimmed', () => {
        expect(keeps('Amina Sesay', text('contains', ' SESAY '))).toBe(true)
        expect(keeps('Amina Sesay', text('contains', 'kamara'))).toBe(false)
        expect(keeps(42, text('contains', '4'))).toBe(true)
    })

    it('equals: the whole trimmed value, any case', () => {
        expect(keeps('  Bo ', text('equals', 'bo'))).toBe(true)
        expect(keeps('Bombali', text('equals', 'bo'))).toBe(false)
    })

    it('startsWith', () => {
        expect(keeps('Bombali', text('startsWith', 'BOM'))).toBe(true)
        expect(keeps('Bombali', text('startsWith', 'ali'))).toBe(false)
    })

    it('reads an empty cell as no text', () => {
        expect(keeps(null, text('contains', 'a'))).toBe(false)
        expect(keeps(undefined, text('equals', 'undefined'))).toBe(false)
    })

    it('empty and notEmpty', () => {
        for (const value of [null, undefined, '']) {
            expect(keeps(value, text('empty', ''))).toBe(true)
            expect(keeps(value, text('notEmpty', ''))).toBe(false)
        }
        for (const value of ['x', 0, false]) {
            expect(keeps(value, text('empty', ''))).toBe(false)
            expect(keeps(value, text('notEmpty', ''))).toBe(true)
        }
    })
})

describe('number', () => {
    it('keeps values within inclusive bounds', () => {
        const range: DataTableFilterValue = { kind: 'number', min: 18, max: 30 }
        expect(keeps(18, range)).toBe(true)
        expect(keeps(30, range)).toBe(true)
        expect(keeps('25', range)).toBe(true)
        expect(keeps(17, range)).toBe(false)
        expect(keeps(31, range)).toBe(false)
    })

    it('takes one bound alone', () => {
        expect(keeps(99, { kind: 'number', min: 18 })).toBe(true)
        expect(keeps(-4, { kind: 'number', max: 0 })).toBe(true)
        expect(keeps(1, { kind: 'number', max: 0 })).toBe(false)
    })

    it('never keeps an empty or non-numeric cell', () => {
        const any: DataTableFilterValue = { kind: 'number', min: -100 }
        expect(keeps(null, any)).toBe(false)
        expect(keeps(undefined, any)).toBe(false)
        expect(keeps('', any)).toBe(false)
        expect(keeps('abc', any)).toBe(false)
    })
})

describe('date', () => {
    it('compares the first ten characters with inclusive bounds', () => {
        const range: DataTableFilterValue = {
            kind: 'date',
            from: '2024-03-01',
            to: '2024-03-31',
        }
        expect(keeps('2024-03-01', range)).toBe(true)
        expect(keeps('2024-03-31T23:59:59.000', range)).toBe(true)
        expect(keeps('2024-02-29', range)).toBe(false)
        expect(keeps('2024-04-01', range)).toBe(false)
    })

    it('takes one bound alone', () => {
        expect(keeps('2030-01-01', { kind: 'date', from: '2024-01-01' })).toBe(
            true
        )
        expect(keeps('2030-01-01', { kind: 'date', to: '2024-01-01' })).toBe(
            false
        )
    })

    it('never keeps an empty cell', () => {
        const any: DataTableFilterValue = { kind: 'date', to: '9999-12-31' }
        expect(keeps(null, any)).toBe(false)
        expect(keeps(undefined, any)).toBe(false)
        expect(keeps('', any)).toBe(false)
    })
})

describe('options', () => {
    const chosen: DataTableFilterValue = {
        kind: 'options',
        values: ['Bo', 'Kenema'],
    }

    it('keeps a cell that is one of the values', () => {
        expect(keeps('Bo', chosen)).toBe(true)
        expect(keeps('Bombali', chosen)).toBe(false)
        expect(keeps(null, chosen)).toBe(false)
    })

    it('compares the cell as a string', () => {
        expect(keeps(2, { kind: 'options', values: ['1', '2'] })).toBe(true)
    })

    it('keeps an array cell that overlaps the values', () => {
        expect(keeps(['Bombali', 'Kenema'], chosen)).toBe(true)
        expect(keeps(['Bombali'], chosen)).toBe(false)
        expect(keeps([], chosen)).toBe(false)
    })
})

describe('boolean', () => {
    it('matches true and "true"', () => {
        const yes: DataTableFilterValue = { kind: 'boolean', value: true }
        expect(keeps(true, yes)).toBe(true)
        expect(keeps('true', yes)).toBe(true)
        expect(keeps(false, yes)).toBe(false)
        expect(keeps(null, yes)).toBe(false)
    })

    it('matches false and "false"', () => {
        const no: DataTableFilterValue = { kind: 'boolean', value: false }
        expect(keeps(false, no)).toBe(true)
        expect(keeps('false', no)).toBe(true)
        expect(keeps(true, no)).toBe(false)
        expect(keeps(null, no)).toBe(false)
        expect(keeps(undefined, no)).toBe(false)
    })
})

it('custom keeps every row: its column filters it', () => {
    expect(keeps('anything', { kind: 'custom', value: 'x' })).toBe(true)
    expect(keeps(null, { kind: 'custom', value: 'x' })).toBe(true)
})

it('keeps every row for an empty value', () => {
    expect(keeps('x', text('contains', '  '))).toBe(true)
    expect(keeps('x', { kind: 'number' })).toBe(true)
    expect(keeps('x', { kind: 'date' })).toBe(true)
    expect(keeps('x', { kind: 'options', values: [] })).toBe(true)
})

it('keeps every row for a value it cannot parse', () => {
    for (const value of [
        'Amina',
        42,
        null,
        { kind: 'text', text: 'Amina' },
        { kind: 'number', min: 'ten' },
        { kind: 'date', from: '01/02/2024' },
        { kind: 'colour', value: 'red' },
    ]) {
        expect(keepsStored('Bo', { id: 'value', value })).toBe(true)
    }
})

describe('autoRemove', () => {
    const removes = (entry: ColumnFilter) =>
        dataTableFilterFn.autoRemove?.(entry.value)

    it('drops empty values and the empty string', () => {
        expect(removes({ id: 'value', value: '' })).toBe(true)
        expect(removes({ id: 'value', value: text('contains', ' ') })).toBe(
            true
        )
        expect(removes({ id: 'value', value: { kind: 'number' } })).toBe(true)
        expect(
            removes({ id: 'value', value: { kind: 'custom', value: '' } })
        ).toBe(true)
    })

    it('keeps set values, including false and empty-cell operators', () => {
        expect(
            removes({ id: 'value', value: { kind: 'boolean', value: false } })
        ).toBe(false)
        expect(removes({ id: 'value', value: text('empty', '') })).toBe(false)
        expect(removes({ id: 'value', value: text('contains', 'a') })).toBe(
            false
        )
    })

    it('leaves values that are not filter values to their owner', () => {
        expect(removes({ id: 'value', value: 'Amina' })).toBe(false)
        expect(removes({ id: 'value', value: ['a'] })).toBe(false)
    })
})
