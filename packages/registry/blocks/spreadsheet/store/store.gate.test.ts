import { createStore } from 'zustand/vanilla'
import type { Field } from '@/components/dhis2-value-types'
import type { AnnotationsState, CellAnnotations } from '../model/annotations'
import type { CellKey } from '../model/types'
import { EMPTY_CELL, addsHiddenOption, createCellStore } from './store'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
const CHOICE: Field = {
    valueType: 'TEXT',
    options: ['A', 'B', 'C'].map((code) => ({ code, name: code })),
}
const MULTI: Field = { ...CHOICE, valueType: 'MULTI_TEXT' }
const fields = new Map<string, Field>([
    ['n', { valueType: 'INTEGER' }],
    ['one', CHOICE],
    ['many', MULTI],
])
const N: CellKey = 'r1.n'
const ONE: CellKey = 'r1.one'
const MANY: CellKey = 'r1.many'

const setup = (initial: Array<[CellKey, string]> = []) => {
    const enqueued: Array<[CellKey, string | null, string | null]> = []
    const annotations = createStore<AnnotationsState>()(() => ({
        cells: {},
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))
    const store = createCellStore({
        fields,
        values: new Map(initial),
        settings: GREGORIAN,
        annotations,
        enqueue: (key, value, base) => enqueued.push([key, value, base]),
    })
    const say = (key: CellKey, note: Partial<CellAnnotations>) =>
        annotations.setState({
            cells: { [key]: { required: false, messages: [], ...note } },
        })
    const cell = (key: CellKey) => store.getState().cells[key] ?? EMPTY_CELL
    return { store, enqueued, say, cell }
}

test('a person’s text into a hidden cell writes nothing', () => {
    const { store, enqueued, say, cell } = setup()
    say(N, { hiddenBy: 'Hidden by rule' })
    expect(store.getState().commit(N, '5')).toBe('unchanged')
    expect(store.getState().commit(N, 'abc')).toBe('unchanged')
    expect(cell(N)).toBe(EMPTY_CELL)
    expect(enqueued).toEqual([])
})

test('a rule’s value into a hidden cell is saved', () => {
    const { store, enqueued, say } = setup()
    say(N, { hiddenBy: 'Hidden by rule' })
    expect(store.getState().commit(N, '5', 'rule')).toBe('queued')
    expect(enqueued).toEqual([[N, '5', null]])
})

test('a person cannot write a read-only cell', () => {
    const { store, enqueued, say } = setup([[N, '1']])
    say(N, { readOnly: 'Assigned by rule' })
    expect(store.getState().commit(N, '2')).toBe('unchanged')
    expect(store.getState().commit(N, '')).toBe('unchanged')
    expect(enqueued).toEqual([])
})

test('undo skips a cell a rule now hides', () => {
    const { store, enqueued, say } = setup()
    store.getState().commit(N, '5')
    say(N, { hiddenBy: 'Hidden by rule' })
    expect(store.getState().undo()).toEqual([])
    expect(enqueued).toEqual([[N, '5', null]])
})

test('an option a rule hides is refused, a held one is kept', () => {
    const { store, enqueued, say, cell } = setup([
        [ONE, 'C'],
        [MANY, 'A,C'],
    ])
    say(ONE, { hiddenOptions: new Set(['B', 'C']) })
    expect(store.getState().commit(ONE, 'B')).toBe('invalid')
    expect(cell(ONE)).toMatchObject({
        value: 'C',
        draft: 'B',
        error: 'Choose one of the options',
    })
    expect(store.getState().commit(ONE, 'C')).toBe('unchanged')
    expect(store.getState().commit(ONE, 'A')).toBe('queued')

    say(MANY, { hiddenOptions: new Set(['B', 'C']) })
    // Dropping A keeps the held C; adding B is refused.
    expect(store.getState().commit(MANY, 'C')).toBe('queued')
    expect(store.getState().commit(MANY, 'B,C')).toBe('invalid')
    expect(cell(MANY).error).toBe('Choose one of the options')
    expect(store.getState().commit(MANY, 'B', 'rule')).toBe('queued')
    expect(enqueued).toEqual([
        [ONE, 'A', 'C'],
        [MANY, 'C', 'A,C'],
        [MANY, 'B', 'A,C'],
    ])
})

test('addsHiddenOption keeps held codes and checks a multi-select code by code', () => {
    const hidden = new Set(['B', 'C'])
    expect(addsHiddenOption(CHOICE, undefined, 'B', undefined)).toBe(false)
    expect(addsHiddenOption(CHOICE, 'C', 'C', hidden)).toBe(false)
    expect(addsHiddenOption(CHOICE, 'C', 'B', hidden)).toBe(true)
    expect(addsHiddenOption(MULTI, 'A,C', 'C', hidden)).toBe(false)
    expect(addsHiddenOption(MULTI, 'C', 'B,C', hidden)).toBe(true)
    expect(addsHiddenOption(MULTI, undefined, 'A', hidden)).toBe(false)
})

test('blank is never refused, and a batch answers for each entry', () => {
    const { store, enqueued, say } = setup([[ONE, 'C']])
    say(ONE, { hiddenOptions: new Set(['C']) })
    expect(store.getState().commit(ONE, '')).toBe('queued')
    say(N, { hiddenBy: 'Hidden by rule' })
    expect(
        store.getState().commitMany([
            { key: N, text: '5' },
            { key: MANY, text: 'A' },
        ])
    ).toEqual(['unchanged', 'queued'])
    expect(enqueued).toEqual([
        [ONE, null, 'C'],
        [MANY, 'A', null],
    ])
})
