import { createStore } from 'zustand/vanilla'
import type { Field } from '@/components/dhis2-value-types'
import type { AnnotationsState } from '../model/annotations'
import { cellAt, cellKey } from '../model/types'
import { createCellStore } from './store'

const CHOICE: Field = {
    valueType: 'TEXT',
    options: ['A', 'B'].map((code) => ({ code, name: code })),
}

const annotations = () =>
    createStore<AnnotationsState>()(() => ({
        cells: {},
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))

const setup = (notes = annotations()) => {
    const store = createCellStore({
        fields: new Map<string, Field>([
            ['c1', { valueType: 'INTEGER' }],
            ['c2', CHOICE],
        ]),
        values: new Map([[cellKey('r1', 'c2'), 'A']]),
        settings: { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' },
        annotations: notes,
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
    expect(cellAt(store.getState().cells, cellKey('r1', 'c1'))?.value).toBe('1')
    expect(
        cellAt(store.getState().cells, cellKey('r2', 'c1'))?.value
    ).toBeUndefined()
})

test('undo of a 15,000-cell commit returns the keys in commit order', () => {
    const store = setup()
    const keys = Array.from({ length: 15000 }, (_, i) => cellKey(`r${i}`, 'c1'))
    store.getState().commitMany(keys.map((key) => ({ key, text: '1' })))
    expect(store.getState().undo()).toEqual(keys)
})

test('undo does not write back an option the rules hide', () => {
    const notes = annotations()
    const store = setup(notes)
    const key = cellKey('r1', 'c2')
    store.getState().commit(key, 'B')
    notes.setState({
        cells: {
            [key]: {
                required: false,
                messages: [],
                hiddenOptions: new Set(['A']),
            },
        },
    })
    expect(store.getState().undo()).toEqual([])
    expect(cellAt(store.getState().cells, key)?.value).toBe('B')
})
