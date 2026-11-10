import type { GridTable } from '../model/types'
import { columnHeaderIds } from './headers'

test('a heading spanning two rows names its column beside a group', () => {
    const table: GridTable = {
        id: 't1',
        title: 'Table t1',
        rows: [],
        columns: ['Name', 'Initiated', 'Completed'].map((label, i) => ({
            id: `c${i}`,
            label,
            field: { valueType: 'INTEGER' },
        })),
        closed: new Map(),
        headerRows: [
            [
                { id: 'name', label: 'Name', span: 1, rowSpan: 2 },
                { id: 'ifa', label: 'IFA', span: 2 },
            ],
            [
                { id: 'init', label: 'Initiated', span: 1 },
                { id: 'done', label: 'Completed', span: 1 },
            ],
        ],
    }
    expect(columnHeaderIds('s', table)).toEqual([
        's-t1-header-name',
        's-t1-header-ifa s-t1-header-init',
        's-t1-header-ifa s-t1-header-done',
    ])
})
