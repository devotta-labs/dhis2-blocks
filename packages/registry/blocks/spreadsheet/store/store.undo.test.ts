import { createStore } from 'zustand/vanilla'
import type { Field } from '@/components/dhis2-value-types'
import type { AnnotationsState } from '../model/annotations'
import { cellKey } from '../model/types'
import { createCellStore } from './store'

const setup = () => {
    const store = createCellStore({
        fields: new Map<string, Field>([['c1', { valueType: 'INTEGER' }]]),
        values: new Map(),
        settings: { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' },
        annotations: createStore<AnnotationsState>()(() => ({
            cells: {},
            rowMessages: new Map(),
            rowNotes: new Map(),
        })),
        enqueue: () => undefined,
    })
    return store
}

test('undo keeps the last 100 commits', () => {
    const store = setup()
    for (let i = 1; i <= 101; i++) {
        store.getState().commit(cellKey(`r${i}`, 'c1'), '1')
    }
    for (let i = 0; i < 101; i++) {
        store.getState().undo()
    }
    expect(store.getState().cells[cellKey('r1', 'c1')]?.value).toBe('1')
    expect(store.getState().cells[cellKey('r2', 'c1')]?.value).toBeUndefined()
})

test('undo of a 15,000-cell commit returns the keys in commit order', () => {
    const store = setup()
    const keys = Array.from({ length: 15000 }, (_, i) => cellKey(`r${i}`, 'c1'))
    store.getState().commitMany(keys.map((key) => ({ key, text: '1' })))
    expect(store.getState().undo()).toEqual(keys)
})
