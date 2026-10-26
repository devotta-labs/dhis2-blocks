import { cellKey } from '../model/types'
import type {
    CellKey,
    EventStatus,
    GridColumn,
    GridRow,
    GridTable,
    HeaderCell,
    PendingChange,
    PendingRow,
} from '../model/types'
import { EMPTY_CELL, createDataEntryStore } from './store'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

const ACTIVE: EventStatus = 'ACTIVE'
const rows: GridRow[] = [
    { id: 'r1', label: 'Visit 1', status: ACTIVE },
    { id: 'r2', label: 'Visit 2', status: ACTIVE },
]
const columns: GridColumn[] = [
    { id: 'c1', label: 'Children', field: { valueType: 'INTEGER' } },
    { id: 'c2', label: 'Referred', field: { valueType: 'BOOLEAN' } },
]
const headerRows: HeaderCell[][] = [
    columns.map(({ id, label }) => ({ id, label, span: 1 })),
]
const table: GridTable = {
    id: 't1',
    title: 'Visit',
    rows,
    columns,
    headerRows,
    closed: new Map([[cellKey('r2', 'c2'), 'Not used']]),
}

const setup = (initial: Array<[CellKey, string]> = []) => {
    const enqueued: Array<[CellKey, string | null, string | null]> = []
    const store = createDataEntryStore({
        tables: [table],
        values: new Map(initial),
        settings: GREGORIAN,
        enqueue: (key, value, base) => enqueued.push([key, value, base]),
    })
    const cell = (key: CellKey) => store.getState().cells[key] ?? EMPTY_CELL
    const commit = (key: CellKey, text: string, source?: 'person' | 'rule') =>
        store.getState().commit(key, text, source)
    return { store, enqueued, cell, commit }
}

test('a valid value is set and queued', () => {
    const { enqueued, cell, commit } = setup()
    expect(commit('r1.c1', '5')).toBe('queued')
    expect(cell('r1.c1')).toMatchObject({ value: '5', sync: 'queued' })
    expect(enqueued).toEqual([['r1.c1', '5', null]])
})

test('invalid text is kept as a draft and not queued', () => {
    const { enqueued, cell, commit } = setup()
    expect(commit('r1.c1', 'abc')).toBe('invalid')
    expect(cell('r1.c1')).toMatchObject({
        draft: 'abc',
        error: 'Enter a whole number',
    })
    expect(enqueued).toEqual([])
})

test('the same value is not queued again', () => {
    const { enqueued, cell, commit } = setup([['r1.c1', '5']])
    expect(commit('r1.c1', '5')).toBe('unchanged')
    expect(cell('r1.c1')).toMatchObject({ value: '5', sync: 'idle' })
    expect(enqueued).toEqual([])
})

test('blank on an empty cell is unchanged', () => {
    const { store, enqueued, commit } = setup()
    expect(commit('r1.c1', '  ')).toBe('unchanged')
    expect(enqueued).toEqual([])
    expect(store.getState().cells).toEqual({})
})

test('blank deletes the value', () => {
    const { enqueued, cell, commit } = setup([['r1.c1', '5']])
    expect(commit('r1.c1', '')).toBe('queued')
    expect(cell('r1.c1').value).toBeUndefined()
    expect(enqueued).toEqual([['r1.c1', null, '5']])
})

test('typed text is stored in its stored form', () => {
    const { cell, commit } = setup()
    commit('r1.c2', ' Yes ')
    expect(cell('r1.c2').value).toBe('true')
})

test('a valid value clears the draft and error', () => {
    const { cell, commit } = setup()
    commit('r1.c1', 'abc')
    commit('r1.c1', '5')
    expect(cell('r1.c1').draft).toBeUndefined()
    expect(cell('r1.c1').error).toBeUndefined()
})

test('re-entering the stored value clears the draft', () => {
    const { enqueued, cell, commit } = setup([['r1.c1', '5']])
    commit('r1.c1', 'abc')
    expect(commit('r1.c1', '5')).toBe('unchanged')
    expect(cell('r1.c1').draft).toBeUndefined()
    expect(cell('r1.c1').error).toBeUndefined()
    expect(enqueued).toEqual([])
})

test('a rule commit is marked as the rule’s', () => {
    const { cell, commit } = setup()
    commit('r1.c1', '10', 'rule')
    expect(cell('r1.c1').source).toBe('rule')
})

test('a person’s commit takes the cell back from a rule', () => {
    const { cell, commit } = setup()
    commit('r1.c1', '10', 'rule')
    commit('r1.c1', '11')
    expect(cell('r1.c1').source).toBe('person')
})

test('undo restores the previous value as a new change', () => {
    const { store, enqueued, cell, commit } = setup([['r1.c1', '5']])
    commit('r1.c1', '6')
    expect(store.getState().undo()).toBe(true)
    expect(cell('r1.c1')).toMatchObject({ value: '5', sync: 'queued' })
    expect(enqueued).toEqual([
        ['r1.c1', '6', '5'],
        ['r1.c1', '5', '5'],
    ])
})

test('undo steps back through changes in the grid, newest first', () => {
    const { store, cell, commit } = setup()
    commit('r1.c1', '1')
    commit('r2.c1', '2')
    commit('r1.c1', '3')
    store.getState().undo()
    expect(cell('r1.c1').value).toBe('1')
    store.getState().undo()
    expect(cell('r2.c1').value).toBeUndefined()
    store.getState().undo()
    expect(cell('r1.c1').value).toBeUndefined()
})

test('undo has nothing to do when nothing was changed', () => {
    const { store, enqueued } = setup([['r1.c1', '5']])
    expect(store.getState().undo()).toBe(false)
    expect(enqueued).toEqual([])
})

test('undo is not itself undone by a second undo', () => {
    const { store, cell, commit } = setup([['r1.c1', '5']])
    commit('r1.c1', '6')
    store.getState().undo()
    expect(store.getState().undo()).toBe(false)
    expect(cell('r1.c1').value).toBe('5')
})

test('undo skips changes that were rejected or unchanged', () => {
    const { store, cell, commit } = setup([['r1.c1', '5']])
    commit('r1.c1', '6')
    commit('r1.c1', 'abc')
    commit('r1.c1', '6')
    store.getState().undo()
    expect(cell('r1.c1')).toMatchObject({ value: '5', sync: 'queued' })
    expect(cell('r1.c1').draft).toBeUndefined()
    expect(store.getState().undo()).toBe(false)
})

test('a rule’s change is not on the undo stack', () => {
    const { store, cell, commit } = setup()
    commit('r1.c1', '10', 'rule')
    expect(store.getState().undo()).toBe(false)
    expect(cell('r1.c1').value).toBe('10')
})

test('legacy values are flagged on load, not changed', () => {
    const { enqueued, cell } = setup([['r1.c1', '12.5']])
    expect(cell('r1.c1')).toMatchObject({
        warning: 'Enter a whole number',
        value: '12.5',
        sync: 'idle',
    })
    expect(enqueued).toEqual([])
})

test('editing a flagged value clears its warning', () => {
    const { cell, commit } = setup([['r1.c1', '12.5']])
    commit('r1.c1', '12')
    expect(cell('r1.c1').warning).toBeUndefined()
})

test('markSync sets the state and reason of the cells given only', () => {
    const { store, cell, commit } = setup()
    commit('r1.c1', '5')
    commit('r2.c1', '6')
    store.getState().markSync([{ key: 'r1.c1', value: '5' }], 'failed', 'E1302')
    expect(cell('r1.c1')).toMatchObject({ sync: 'failed', reason: 'E1302' })
    expect(cell('r2.c1')).toMatchObject({ sync: 'queued' })
    store.getState().markSync([{ key: 'r1.c1', value: '5' }], 'sending')
    expect(cell('r1.c1').reason).toBeUndefined()
})

test('a saved cell’s base becomes the value that was sent', () => {
    const { store, enqueued, cell, commit } = setup([['r1.c1', '5']])
    commit('r1.c1', '6')
    store.getState().markSync([{ key: 'r1.c1', value: '6' }], 'saved')
    expect(cell('r1.c1')).toMatchObject({
        base: '6',
        value: '6',
        sync: 'saved',
    })
    commit('r1.c1', '7')
    expect(enqueued.at(-1)).toEqual(['r1.c1', '7', '6'])
})

test('a saved delete leaves the cell with no base', () => {
    const { store, cell, commit } = setup([['r1.c1', '5']])
    commit('r1.c1', '')
    store.getState().markSync([{ key: 'r1.c1', value: null }], 'saved')
    expect(cell('r1.c1')).toMatchObject({ sync: 'saved' })
    expect(cell('r1.c1').base).toBeUndefined()
})

test('a result for an older value does not touch a newer change', () => {
    const { store, cell, commit } = setup()
    commit('r1.c1', '6')
    commit('r1.c1', '7')
    store.getState().markSync([{ key: 'r1.c1', value: '6' }], 'saved')
    expect(cell('r1.c1')).toMatchObject({
        base: '6',
        value: '7',
        sync: 'queued',
    })
    store.getState().markSync([{ key: 'r1.c1', value: '6' }], 'failed', 'E')
    expect(cell('r1.c1')).toMatchObject({ sync: 'queued' })
    expect(cell('r1.c1').reason).toBeUndefined()
})

test('markSync ignores cells that hold nothing', () => {
    const { store } = setup()
    store.getState().markSync([{ key: 'r1.c1', value: '5' }], 'saved')
    expect(store.getState().cells).toEqual({})
})

test('a person committing the same value on a failed cell queues it again', () => {
    const { store, enqueued, cell, commit } = setup([['r1.c1', '5']])
    commit('r1.c1', '6')
    store.getState().markSync([{ key: 'r1.c1', value: '6' }], 'failed', 'E1302')
    expect(commit('r1.c1', '6')).toBe('queued')
    expect(cell('r1.c1')).toMatchObject({ value: '6', sync: 'queued' })
    expect(cell('r1.c1').reason).toBeUndefined()
    expect(enqueued).toEqual([
        ['r1.c1', '6', '5'],
        ['r1.c1', '6', '5'],
    ])
    // No second undo entry: one undo goes back to the loaded value.
    store.getState().undo()
    expect(cell('r1.c1').value).toBe('5')
    expect(store.getState().undo()).toBe(false)
})

test('a failed delete is queued again by a blank commit', () => {
    const { store, enqueued, commit } = setup([['r1.c1', '5']])
    commit('r1.c1', '')
    store.getState().markSync([{ key: 'r1.c1', value: null }], 'failed', 'E')
    expect(commit('r1.c1', '')).toBe('queued')
    expect(enqueued.at(-1)).toEqual(['r1.c1', null, '5'])
})

test('a rule committing the same value on a failed cell leaves it', () => {
    const { store, enqueued, cell, commit } = setup()
    commit('r1.c1', '6')
    store.getState().markSync([{ key: 'r1.c1', value: '6' }], 'failed', 'E1302')
    expect(commit('r1.c1', '6', 'rule')).toBe('unchanged')
    expect(cell('r1.c1')).toMatchObject({ sync: 'failed', reason: 'E1302' })
    expect(enqueued).toHaveLength(1)
})

test('cells nobody touched have no entry', () => {
    const { store } = setup([['r1.c1', '5']])
    expect(store.getState().cells['r2.c1']).toBeUndefined()
    expect(Object.isFrozen(EMPTY_CELL)).toBe(true)
})

test('restore puts unsent changes back as saved on this device', () => {
    const { store, enqueued, cell } = setup([['r1.c1', '5']])
    const row: PendingRow = {
        programStageId: 'ps',
        orgUnitId: 'ou',
        isNew: false,
    }
    const changes: PendingChange[] = [
        { sourceKey: 's', key: 'r1.c1', value: '9', base: '5', at: 1, row },
        { sourceKey: 's', key: 'r2.c1', value: null, base: '3', at: 2 },
    ]
    store.getState().restore(changes)
    expect(cell('r1.c1')).toMatchObject({
        value: '9',
        base: '5',
        sync: 'queued',
    })
    expect(cell('r2.c1')).toMatchObject({ base: '3', sync: 'queued' })
    expect(cell('r2.c1').value).toBeUndefined()
    // The outbox already holds them.
    expect(enqueued).toEqual([])
})

test('restore keeps the state and reason an unsent change was left in', () => {
    const { store, enqueued, cell } = setup()
    store.getState().restore([
        {
            sourceKey: 's',
            key: 'r1.c1',
            value: '9',
            base: null,
            at: 1,
            sync: 'failed',
            reason: 'E1302',
        },
        { sourceKey: 's', key: 'r2.c1', value: '4', base: null, at: 2 },
    ])
    expect(cell('r1.c1')).toMatchObject({ sync: 'failed', reason: 'E1302' })
    expect(cell('r2.c1')).toMatchObject({ sync: 'queued' })
    expect(enqueued).toEqual([])
})

test('committing to a cell with no column is a mistake', () => {
    const { commit } = setup()
    expect(() => commit('r1.nope', '5')).toThrow()
})

const THREE = [
    { key: cellKey('r1', 'c1'), text: '1' },
    { key: cellKey('r2', 'c1'), text: '2' },
    { key: cellKey('r1', 'c2'), text: 'yes' },
]

test('commitMany queues every cell, in order, in one store update', () => {
    const { store, enqueued, cell } = setup()
    let updates = 0
    store.subscribe(() => {
        updates += 1
    })
    expect(store.getState().commitMany(THREE)).toEqual([
        'queued',
        'queued',
        'queued',
    ])
    expect(updates).toBe(1)
    expect(cell('r1.c2')).toMatchObject({ value: 'true', sync: 'queued' })
    expect(enqueued).toEqual([
        ['r1.c1', '1', null],
        ['r2.c1', '2', null],
        ['r1.c2', 'true', null],
    ])
})

test('one undo reverts a whole commitMany', () => {
    const { store, enqueued, cell, commit } = setup([['r2.c1', '9']])
    commit('r1.c1', '0')
    store.getState().commitMany(THREE)
    enqueued.length = 0
    let updates = 0
    store.subscribe(() => {
        updates += 1
    })
    expect(store.getState().undo()).toBe(true)
    expect(updates).toBe(1)
    expect(cell('r1.c1').value).toBe('0')
    expect(cell('r2.c1').value).toBe('9')
    expect(cell('r1.c2').value).toBeUndefined()
    expect(enqueued).toEqual([
        ['r1.c2', null, null],
        ['r2.c1', '9', '9'],
        ['r1.c1', '0', null],
    ])
    // The earlier single commit is the next undo.
    store.getState().undo()
    expect(cell('r1.c1').value).toBeUndefined()
})

test('commitMany reports each cell and queues only the changed ones', () => {
    const { store, enqueued, cell } = setup([['r1.c1', '5']])
    expect(
        store.getState().commitMany([
            { key: 'r1.c1', text: '5' },
            { key: 'r2.c1', text: 'abc' },
            { key: 'r1.c2', text: 'no' },
        ])
    ).toEqual(['unchanged', 'invalid', 'queued'])
    expect(cell('r2.c1')).toMatchObject({ draft: 'abc' })
    expect(enqueued).toEqual([['r1.c2', 'false', null]])
})

test('commitMany with nothing to change does not update the store', () => {
    const { store } = setup([['r1.c1', '5']])
    let updates = 0
    store.subscribe(() => {
        updates += 1
    })
    store.getState().commitMany([{ key: 'r1.c1', text: '5' }])
    expect(updates).toBe(0)
})

test('a rule’s commitMany is not on the undo stack', () => {
    const { store } = setup()
    store.getState().commitMany(THREE, 'rule')
    expect(store.getState().undo()).toBe(false)
})

test('a commitMany with a cell that has no column changes nothing', () => {
    const { store, enqueued } = setup()
    expect(() =>
        store.getState().commitMany([
            { key: 'r1.c1', text: '1' },
            { key: 'r1.nope', text: '2' },
        ])
    ).toThrow()
    expect(store.getState().cells).toEqual({})
    expect(enqueued).toEqual([])
})

test('undo leaves a cell that already has the earlier value', () => {
    const { store, enqueued, commit } = setup([['r1.c1', '5']])
    commit('r1.c1', '6')
    commit('r1.c1', '5', 'rule')
    enqueued.length = 0
    expect(store.getState().undo()).toBe(true)
    expect(enqueued).toEqual([])
})

test('a batch that changes one cell twice undoes to the value before the batch', () => {
    const { store, enqueued, cell } = setup([['r1.c1', '5']])
    store.getState().commitMany([
        { key: 'r1.c1', text: '6' },
        { key: 'r1.c1', text: '7' },
    ])
    expect(store.getState().undo()).toBe(true)
    expect(cell('r1.c1').value).toBe('5')
    expect(enqueued.at(-1)).toEqual(['r1.c1', '5', '5'])
    expect(enqueued).toHaveLength(3)
})

test('an outcome for an older value that was not saved changes nothing', () => {
    const { store, commit } = setup()
    commit('r1.c1', '6')
    commit('r1.c1', '7')
    const before = store.getState().cells
    store.getState().markSync([{ key: 'r1.c1', value: '6' }], 'failed', 'E1302')
    expect(store.getState().cells).toBe(before)
})
