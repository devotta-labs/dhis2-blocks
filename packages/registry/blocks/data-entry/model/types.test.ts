import { formOf, indexCells, keyOf, recordsOf, rowsByRecord } from './types'
import type {
    CellKey,
    DataRecord,
    GridColumn,
    GridRow,
    GridTable,
} from './types'

test('a record’s form: an event’s stage, an enrolment’s program, a person’s type', () => {
    const records: DataRecord[] = [
        {
            kind: 'event',
            id: 'event1',
            programStageId: 'stage1',
            orgUnitId: 'orgUnit1',
            status: 'ACTIVE',
        },
        {
            kind: 'enrollment',
            id: 'enrollment1',
            programId: 'program1',
            trackedEntityId: 'person1',
            orgUnitId: 'orgUnit1',
            status: 'ACTIVE',
        },
        {
            kind: 'trackedEntity',
            id: 'person1',
            trackedEntityTypeId: 'type1',
            orgUnitId: 'orgUnit1',
        },
    ]
    expect(records.map(formOf)).toEqual(['stage1', 'program1', 'type1'])
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

test('records of a row: its own id, then its slots’, each once', () => {
    expect(recordsOf(AMINA)).toEqual(['p1', 'e2'])
    // A register's row is its enrolment, which is also a slot.
    expect(
        recordsOf({ id: 'en1', slots: { person: 'p1', enrollment: 'en1' } })
    ).toEqual(['en1', 'p1'])
})

const NAME: GridColumn = { id: 'name', label: 'Name', field: INTEGER }
const register = (
    columns: GridColumn[],
    closed: Array<[CellKey, string]> = []
): GridTable => ({
    id: 't1',
    title: 'Register',
    rows: [AMINA],
    columns,
    headerRows: [],
    closed: new Map(closed),
})

test('the cell index leaves closed cells out', () => {
    const index = indexCells([
        register([NAME, VISIT_2_DATE], [['e2.occurredAt', 'Not used']]),
    ])
    expect([...index]).toEqual([['p1.name', { table: 0, row: 0, column: 0 }]])
})

test('a closed cell saving to another cell’s key is an error too', () => {
    const again: GridColumn = { ...NAME, id: 'again', fieldId: 'name' }
    expect(() =>
        indexCells([register([NAME, again], [['p1.name', 'Not used']])])
    ).toThrowError(new Error('Two cells of the table t1 save to p1.name'))
})

test('each record’s row: its own and its slots’', () => {
    const baraka: GridRow = { id: 'p2', label: 'Baraka' }
    const rows = rowsByRecord([
        register([NAME]),
        { ...register([NAME]), id: 't2', rows: [baraka] },
    ])
    expect([...rows]).toEqual([
        ['p1', AMINA],
        ['e2', AMINA],
        ['p2', baraka],
    ])
})
