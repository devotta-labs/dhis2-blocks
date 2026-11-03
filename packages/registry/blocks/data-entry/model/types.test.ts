import { formOf, indexCells, keyOf, recordsOf } from './types'
import type { EventRecord, GridColumn, GridRow, GridTable } from './types'

test('an event’s form is its stage', () => {
    const record: EventRecord = {
        kind: 'event',
        id: 'event1',
        programStageId: 'stage1',
        orgUnitId: 'orgUnit1',
        status: 'ACTIVE',
    }
    expect(formOf(record)).toBe('stage1')
})

const INTEGER = { valueType: 'INTEGER' } as const
const AMINA: GridRow = { id: 'p1', label: 'Amina', slots: { visit2: 'e2' } }
const VISIT_2_DATE: GridColumn = {
    id: 'visit2:occurredAt',
    label: 'Visit 2',
    field: { valueType: 'DATE' },
    slot: 'visit2',
    fieldId: 'occurredAt',
}

test('a column keys its cells by its slot’s record and its field', () => {
    expect(keyOf(AMINA, VISIT_2_DATE)).toBe('e2.occurredAt')
    expect(keyOf(AMINA, { id: 'name', label: 'Name', field: INTEGER })).toBe(
        'p1.name'
    )
})

test('a row without the slot a column uses is an error', () => {
    expect(() =>
        keyOf({ id: 'p2', label: 'Baraka' }, VISIT_2_DATE)
    ).toThrowError(new Error('The row p2 has no slot visit2'))
})

test('two cells saving to one key are an error', () => {
    const table: GridTable = {
        id: 't1',
        title: 'Register',
        rows: [AMINA],
        columns: [
            { id: 'first', label: 'First', field: INTEGER, fieldId: 'a' },
            { id: 'second', label: 'Second', field: INTEGER, fieldId: 'a' },
        ],
        headerRows: [],
        closed: new Map(),
    }
    expect(() => indexCells([table])).toThrowError(
        new Error('Two cells of the table t1 save to p1.a')
    )
})

test('records of a row: its own id, then its slots’', () => {
    expect(recordsOf(AMINA)).toEqual(['p1', 'e2'])
})
