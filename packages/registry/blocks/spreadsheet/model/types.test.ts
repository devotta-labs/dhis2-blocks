import { cellKey, indexCells } from './types'
import type { GridTable } from './types'

test('the cell index keys cells with the key function it is given', () => {
    const table: GridTable = {
        id: 't',
        title: 'Aggregate',
        rows: [{ id: 'r1', label: 'Row 1' }],
        columns: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
        ],
        headerRows: [],
        closed: new Map(),
    }
    expect(() =>
        indexCells([table], (row) => cellKey(row.id, 'k'))
    ).toThrowError(new Error('Two cells of the table t save to r1.k'))
})
