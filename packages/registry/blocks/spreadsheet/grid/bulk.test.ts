import i18n from '@dhis2/d2-i18n'
import { createStore } from 'zustand/vanilla'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type { CellOverrides } from '../cells/cellProps'
import type { AnnotationsState, CellAnnotations } from '../model/annotations'
import { cellKey } from '../model/types'
import type { CellKey, GridColumn, GridRow, GridTable } from '../model/types'
import { createCellStore, EMPTY_CELL } from '../store/store'
import {
    clearCandidates,
    columnCandidates,
    planBulk,
    rowCandidates,
} from './bulk'
import { reasonOf } from './navGrid'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
const OWN_FORM = 'Edit this field in its own form'
const NOT_OFFERED = 'This option is not offered here'

const options = ['A', 'B', 'C'].map((code) => ({
    code,
    name: `Option ${code}`,
}))
const fields = new Map<string, Field>([
    ['n', { valueType: 'INTEGER' }],
    ['d', { valueType: 'DATE' }],
    ['o', { valueType: 'TEXT', options }],
    ['m', { valueType: 'MULTI_TEXT', options }],
    ['f', { valueType: 'FILE_RESOURCE' }],
    ['i', { valueType: 'IMAGE' }],
    ['u', { valueType: 'USERNAME' }],
])

const NO_ANNOTATIONS: AnnotationsState = {
    cells: {},
    rowMessages: new Map(),
    rowNotes: new Map(),
}

const rows: GridRow[] = ['r1', 'r2', 'r3'].map((id) => ({ id, label: id }))
const column = (id: string): GridColumn => ({ id, label: id })
const keyOf = (row: GridRow, col: GridColumn) => cellKey(row.id, col.id)

const setup = ({
    values = [],
    annotations = [],
    closed = [],
    overrides,
    settings = GREGORIAN,
}: {
    values?: Array<[CellKey, string]>
    annotations?: Array<[CellKey, Partial<CellAnnotations>]>
    closed?: Array<[CellKey, string]>
    overrides?: CellOverrides
    settings?: ValueSettings
} = {}) => {
    const cells: AnnotationsState['cells'] = {}
    for (const [key, cell] of annotations) {
        cells[key] = { required: false, messages: [], ...cell }
    }
    const effects = createStore<AnnotationsState>()(() => ({
        cells,
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))
    const store = createCellStore({
        fields,
        values: new Map(values),
        settings,
        annotations: effects,
        enqueue: () => {},
    })
    const table: GridTable = {
        id: 't',
        title: 't',
        rows,
        columns: [...fields.keys()].map(column),
        headerRows: [],
        closed: new Map(closed),
    }
    const isEditable = reasonOf(table.closed, store, effects, overrides)
    const plan = (
        candidates: ReadonlyArray<{ key: CellKey; text: string }>,
        overwrite = false
    ) =>
        planBulk(candidates, overwrite, {
            isEditable,
            state: store.getState(),
            annotations: effects.getState(),
            settings,
        })
    const cell = (key: CellKey) => store.getState().cells[key] ?? EMPTY_CELL
    return { store, table, isEditable, plan, cell }
}

describe('reasonOf', () => {
    test('an editable cell has no reason', () => {
        expect(setup().isEditable('r1.n')).toBeUndefined()
    })

    test('names a closed cell by its reason, before anything else', () => {
        const { isEditable } = setup({
            closed: [['r1.n', 'Not used']],
            annotations: [['r1.n', { readOnly: 'Locked' }]],
        })
        expect(isEditable('r1.n')).toBe('Not used')
    })

    test('names a hidden cell by its rule, as the cell does, before its lock', () => {
        const { isEditable } = setup({
            annotations: [
                ['r1.n', { readOnly: 'Locked', hiddenBy: 'Hidden by a rule' }],
                ['r2.n', { readOnly: 'Locked' }],
            ],
        })
        expect(isEditable('r1.n')).toBe('Hidden by a rule')
        expect(isEditable('r2.n')).toBe('Locked')
    })

    test('files, images and usernames are edited in their own form', () => {
        const { isEditable } = setup()
        expect(isEditable('r1.f')).toBe(OWN_FORM)
        expect(isEditable('r1.i')).toBe(OWN_FORM)
        expect(isEditable('r1.u')).toBe(OWN_FORM)
    })

    test('translates the own-form reason once for repeated lookups', () => {
        const translated = vi.spyOn(i18n, 't')
        try {
            const { isEditable } = setup()
            expect(
                ['f', 'i', 'u'].map((field) => isEditable(`r1.${field}`))
            ).toEqual([OWN_FORM, OWN_FORM, OWN_FORM])
            expect(
                translated.mock.calls.filter(
                    ([key]) => String(key) === 'Edit this field in its own form'
                )
            ).toHaveLength(1)
        } finally {
            translated.mockRestore()
        }
    })

    test('a replacement control makes a file cell editable', () => {
        const { isEditable } = setup({
            overrides: { valueTypes: { FILE_RESOURCE: () => null } },
        })
        expect(isEditable('r1.f')).toBeUndefined()
    })
})

describe('planBulk', () => {
    test('fills empty cells only, counting those that hold a value', () => {
        const { table, plan } = setup({ values: [['r2.n', '7']] })
        expect(plan(columnCandidates(table, column('n'), '5', keyOf))).toEqual({
            entries: [
                { key: 'r1.n', text: '5' },
                { key: 'r3.n', text: '5' },
            ],
            skipped: new Map(),
            filled: 1,
        })
    })

    test('overwrites when asked', () => {
        const { table, plan } = setup({ values: [['r2.n', '7']] })
        const { entries, filled } = plan(
            columnCandidates(table, column('n'), '5', keyOf),
            true
        )
        expect(entries.map(({ key }) => key)).toEqual(['r1.n', 'r2.n', 'r3.n'])
        expect(filled).toBe(0)
    })

    test('leaves out a cell that holds the value already, unless its save failed or it has a draft', () => {
        const { table, plan, store } = setup({
            values: [
                ['r1.n', '5'],
                ['r2.n', '5'],
                ['r3.n', '5'],
            ],
        })
        store.getState().markSync([{ key: 'r2.n', value: '5' }], 'failed')
        store.getState().commit('r3.n', 'abc')
        expect(
            plan(columnCandidates(table, column('n'), '5', keyOf), true)
        ).toEqual({
            entries: [
                { key: 'r2.n', text: '5' },
                { key: 'r3.n', text: '5' },
            ],
            skipped: new Map(),
            filled: 0,
        })
    })

    test('clears only cells that hold a value or a draft', () => {
        const { plan, store } = setup({ values: [['r1.n', '7']] })
        store.getState().commit('r2.n', 'abc')
        expect(plan(clearCandidates(['r1.n', 'r2.n', 'r3.n']), true)).toEqual({
            entries: [
                { key: 'r1.n', text: '' },
                { key: 'r2.n', text: '' },
            ],
            skipped: new Map(),
            filled: 0,
        })
    })

    test('counts skipped cells under their reason', () => {
        const { table, plan } = setup({
            closed: [['r1.n', 'Not used']],
            annotations: [
                ['r2.n', { readOnly: 'Event completed' }],
                ['r3.n', { hiddenBy: 'Hidden by a rule' }],
            ],
        })
        const { entries, skipped } = plan(
            columnCandidates(table, column('n'), '5', keyOf),
            true
        )
        expect(entries).toEqual([])
        expect(skipped).toEqual(
            new Map([
                ['Not used', 1],
                ['Event completed', 1],
                ['Hidden by a rule', 1],
            ])
        )
    })

    test('skips an option the cell does not offer', () => {
        const { table, plan } = setup({
            annotations: [
                ['r1.o', { hiddenOptions: new Set(['B']) }],
                ['r2.m', { hiddenOptions: new Set(['B']) }],
                ['r3.m', { hiddenOptions: new Set(['C']) }],
            ],
        })
        expect(
            plan(columnCandidates(table, column('o'), 'Option B', keyOf))
                .skipped
        ).toEqual(new Map([[NOT_OFFERED, 1]]))
        const multi = plan(columnCandidates(table, column('m'), 'A,B', keyOf))
        expect(multi.skipped).toEqual(new Map([[NOT_OFFERED, 1]]))
        expect(multi.entries.map(({ key }) => key)).toEqual(['r1.m', 'r3.m'])
    })

    test('a hidden option the cell already holds is not refused', () => {
        const { plan } = setup({
            values: [['r1.m', 'B']],
            annotations: [['r1.m', { hiddenOptions: new Set(['B']) }]],
        })
        expect(plan([{ key: 'r1.m', text: 'A,B' }], true).entries).toEqual([
            { key: 'r1.m', text: 'A,B' },
        ])
    })

    test('a row copy takes the source row’s values onto the target rows’ empty cells', () => {
        const { table, plan, store, cell } = setup({
            values: [
                ['r1.n', '5'],
                ['r1.o', 'B'],
                ['r3.n', '9'],
            ],
        })
        const candidates = rowCandidates(
            table.columns,
            rows[0],
            rows.slice(1),
            keyOf,
            store.getState(),
            NO_ANNOTATIONS,
            GREGORIAN
        )
        expect(candidates).toEqual([
            { key: 'r2.n', text: '5' },
            { key: 'r3.n', text: '5' },
            { key: 'r2.o', text: 'Option B' },
            { key: 'r3.o', text: 'Option B' },
        ])
        const { entries, filled } = plan(candidates)
        expect(filled).toBe(1)
        store.getState().commitMany(entries)
        expect(cell('r2.n').value).toBe('5')
        expect(cell('r3.n').value).toBe('9')
        expect(cell('r2.o').value).toBe('B')
    })

    // Review focus 1.
    test('a register row copy writes to each target row’s own slot events', () => {
        // Each row holds its own event in each slot (stage) column.
        const slots = [column('anc'), column('pnc')]
        const slotKey = (row: GridRow, col: GridColumn) =>
            cellKey(`${row.id}-${col.id}`, 'n')
        const store = createCellStore({
            fields,
            values: new Map([
                ['r1-anc.n', '1'],
                ['r1-pnc.n', '2'],
            ]),
            settings: GREGORIAN,
            annotations: createStore<AnnotationsState>()(() => NO_ANNOTATIONS),
            enqueue: () => {},
        })
        expect(
            rowCandidates(
                slots,
                rows[0],
                rows.slice(1),
                slotKey,
                store.getState(),
                NO_ANNOTATIONS,
                GREGORIAN
            )
        ).toEqual([
            { key: 'r2-anc.n', text: '1' },
            { key: 'r3-anc.n', text: '1' },
            { key: 'r2-pnc.n', text: '2' },
            { key: 'r3-pnc.n', text: '2' },
        ])
    })

    // Review focus 2.
    test('a copied date saves the same day on a Nepali calendar', () => {
        const NEPALI = { calendar: 'nepali', dateFormat: 'DD-MM-YYYY' } as const
        const { plan, store, cell } = setup({
            values: [['r1.d', '2024-01-15']],
            settings: NEPALI,
        })
        const candidates = rowCandidates(
            [column('d')],
            rows[0],
            [rows[1]],
            keyOf,
            store.getState(),
            NO_ANNOTATIONS,
            NEPALI
        )
        expect(candidates[0].text).not.toContain('2024')
        store.getState().commitMany(plan(candidates).entries)
        expect(cell('r2.d')).toMatchObject({ value: '2024-01-15' })
        expect(cell('r2.d').error).toBeUndefined()
    })

    // Review focus 3.
    test('a row copy skips file, image and username cells as edited in their own form', () => {
        const { table, plan, store } = setup({
            values: [
                ['r1.f', 'file-1'],
                ['r1.i', 'image-1'],
                ['r1.u', 'admin'],
            ],
        })
        const { entries, skipped } = plan(
            rowCandidates(
                table.columns,
                rows[0],
                [rows[1]],
                keyOf,
                store.getState(),
                NO_ANNOTATIONS,
                GREGORIAN
            )
        )
        expect(entries).toEqual([])
        expect(skipped).toEqual(new Map([[OWN_FORM, 3]]))
    })

    // Review focus 4.
    test('a cell holding a refused draft keeps it through a fill-empty action', () => {
        const { table, plan, store, cell } = setup()
        store.getState().commit('r2.n', 'abc')
        const { entries, filled } = plan(
            columnCandidates(table, column('n'), '5', keyOf)
        )
        expect(filled).toBe(1)
        expect(entries.map(({ key }) => key)).toEqual(['r1.n', 'r3.n'])
        store.getState().commitMany(entries)
        expect(cell('r2.n')).toMatchObject({ draft: 'abc' })
        expect(cell('r2.n').value).toBeUndefined()
    })
})
