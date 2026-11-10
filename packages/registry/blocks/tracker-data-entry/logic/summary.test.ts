import i18n from '@dhis2/d2-i18n'
import type { CellKey, CellState, GridTable } from '@/components/spreadsheet'
import type { TrackerColumn, TrackerRow } from '../model/types'
import type { TrackerEffects, TrackerMessage } from './effects'
import { createSummariser, summarise } from './summary'

const NO_EFFECTS: TrackerEffects = { required: false, messages: [] }
const NO_ROW_MESSAGES = new Map<string, TrackerMessage[]>()
const TABLES: GridTable<TrackerRow, TrackerColumn>[] = [
    {
        id: 'program',
        title: 'Visits',
        rows: [],
        columns: [
            { id: 'a', label: 'Height & weight', field: { valueType: 'TEXT' } },
        ],
        headerRows: [],
        closed: new Map(),
    },
]

const FILLED: CellState = {
    value: '1',
    base: '1',
    sync: 'idle',
    source: 'person',
}

test('summarise counts unsent and failed cells and blocks completion on errors', () => {
    const cells = {
        'e1.a': { value: '1', sync: 'queued', source: 'person' },
        'e1.b': {
            value: 'abc',
            sync: 'failed',
            reason: 'Value is not a number',
            source: 'person',
        },
        'e1.c': { value: '3', base: '3', sync: 'saved', source: 'person' },
    } satisfies Partial<Record<CellKey, CellState>>
    const effects = {
        'e1.c': {
            ...NO_EFFECTS,
            messages: [{ tone: 'error', text: 'Too high', source: 'rule' }],
        },
    } satisfies Partial<Record<CellKey, TrackerEffects>>
    expect(summarise(cells, effects, NO_ROW_MESSAGES, TABLES)).toEqual({
        items: [
            {
                key: 'e1.b',
                kind: 'failed',
                text: 'Not saved: Value is not a number',
            },
            { key: 'e1.c', kind: 'error', text: 'Too high' },
        ],
        unsent: 1,
        failed: 1,
        canComplete: false,
    })
})

test('an incremental summary reuses unchanged rows and refreshes changed cells', () => {
    const summarise = createSummariser()
    const cells = {
        'e1.a': {
            ...FILLED,
            sync: 'failed',
            reason: 'First failure',
        },
        'e2.a': {
            ...FILLED,
            sync: 'failed',
            reason: 'Second failure',
        },
    } satisfies Partial<Record<CellKey, CellState>>
    const first = summarise(cells, {}, NO_ROW_MESSAGES, TABLES)
    const next = summarise(
        { ...cells, 'e2.a': { ...cells['e2.a'], reason: 'Retry failed' } },
        {},
        NO_ROW_MESSAGES,
        TABLES
    )

    expect(next).toEqual({
        items: [
            { key: 'e1.a', kind: 'failed', text: 'Not saved: First failure' },
            { key: 'e2.a', kind: 'failed', text: 'Not saved: Retry failed' },
        ],
        unsent: 0,
        failed: 2,
        canComplete: true,
    })
    expect(next.items[0]).toBe(first.items[0])
    expect(next.items[1]).not.toBe(first.items[1])
})

test('an incremental summary notices changed empty-slot results and table labels', () => {
    const summarise = createSummariser()
    const effects = {
        'e1.a': { required: true, messages: [] },
    } satisfies Partial<Record<CellKey, TrackerEffects>>
    const emptySlot = summarise(
        {},
        effects,
        NO_ROW_MESSAGES,
        TABLES,
        undefined,
        () => true
    )
    expect(emptySlot.items).toEqual([])

    const required = summarise(
        {},
        effects,
        NO_ROW_MESSAGES,
        TABLES,
        undefined,
        () => false
    )
    expect(required.items).toEqual([
        {
            key: 'e1.a',
            kind: 'errorOnComplete',
            text: 'Height & weight is required',
            namesField: true,
        },
    ])

    const renamed = summarise(
        {},
        effects,
        NO_ROW_MESSAGES,
        [
            {
                ...TABLES[0],
                columns: [
                    { id: 'a', label: 'Renamed', field: { valueType: 'TEXT' } },
                ],
            },
        ],
        undefined,
        () => false
    )
    expect(renamed.items[0]?.text).toBe('Renamed is required')
})

test('a waiting cell is unsent and says why', () => {
    const summary = summarise(
        {
            'e1.a': {
                value: '1',
                sync: 'waiting',
                reason: 'Waiting for required fields: Age',
                source: 'person',
            },
            'e1.b': { value: '2', sync: 'sending', source: 'person' },
        },
        {},
        NO_ROW_MESSAGES,
        TABLES
    )
    expect(summary).toEqual({
        items: [
            {
                key: 'e1.a',
                kind: 'unsent',
                text: 'Waiting for required fields: Age',
            },
        ],
        unsent: 2,
        failed: 0,
        canComplete: true,
    })
})

test('warnings block nothing', () => {
    const summary = summarise(
        { 'e1.a': FILLED },
        {
            'e1.a': {
                required: true,
                messages: [
                    { tone: 'warning', text: 'Unusual', source: 'rule' },
                ],
            },
        },
        new Map([
            [
                'e1',
                [
                    {
                        tone: 'warning',
                        onComplete: true,
                        text: 'Check the visit date',
                        source: 'rule',
                    },
                ],
            ],
        ]),
        TABLES
    )
    expect(summary.canComplete).toBe(true)
    expect(summary.items).toEqual([
        { key: 'e1.a', kind: 'warning', text: 'Unusual' },
        {
            key: 'e1',
            kind: 'warningOnComplete',
            text: 'Check the visit date',
        },
    ])
})

test('a message on complete is listed as on complete', () => {
    const summary = summarise(
        {},
        {
            'e1.a': {
                required: false,
                messages: [
                    {
                        tone: 'warning',
                        onComplete: true,
                        text: 'Unusual',
                        source: 'rule',
                    },
                ],
            },
        },
        NO_ROW_MESSAGES,
        TABLES
    )
    expect(summary.items).toEqual([
        { key: 'e1.a', kind: 'warningOnComplete', text: 'Unusual' },
    ])
})

test('an empty required cell is listed by its column’s label and blocks completion', () => {
    const required = {
        'e1.a': { required: true, messages: [] },
    } satisfies Partial<Record<CellKey, TrackerEffects>>
    const summarised = (cells: Partial<Record<CellKey, CellState>>) =>
        summarise(cells, required, NO_ROW_MESSAGES, TABLES)

    for (const empty of [{}, { 'e1.a': { ...FILLED, value: undefined } }]) {
        expect(summarised(empty)).toMatchObject({
            // Column labels are shown as DHIS2 gives them, not HTML-escaped.
            items: [
                {
                    key: 'e1.a',
                    kind: 'errorOnComplete',
                    text: 'Height & weight is required',
                },
            ],
            canComplete: false,
        })
    }
    expect(summarised({ 'e1.a': FILLED })).toMatchObject({
        items: [],
        canComplete: true,
    })
})

test('row messages are listed by row, and their errors block completion', () => {
    const withRowMessage = (tone: 'error' | 'warning', onComplete?: true) =>
        summarise(
            {},
            {},
            new Map([
                [
                    'e1',
                    [
                        {
                            tone,
                            text: 'Visit after delivery',
                            source: 'rule',
                            onComplete,
                        },
                    ],
                ],
            ]),
            TABLES
        )

    for (const [onComplete, kind] of [
        [undefined, 'error'],
        [true, 'errorOnComplete'],
    ] as const) {
        expect(withRowMessage('error', onComplete)).toMatchObject({
            items: [{ key: 'e1', kind, text: 'Visit after delivery' }],
            canComplete: false,
        })
    }
    expect(withRowMessage('warning').canComplete).toBe(true)
})

test('a cell’s own error blocks completion; its warning does not', () => {
    const invalid = summarise(
        {
            'e1.a': {
                ...FILLED,
                draft: '12,5',
                error: 'Use a full stop for decimals',
            },
        },
        {},
        NO_ROW_MESSAGES,
        TABLES
    )
    expect(invalid).toMatchObject({
        items: [
            {
                key: 'e1.a',
                kind: 'error',
                text: 'Use a full stop for decimals',
            },
        ],
        canComplete: false,
    })

    const warned = summarise(
        { 'e1.a': { ...FILLED, warning: 'Not a valid option' } },
        {},
        NO_ROW_MESSAGES,
        TABLES
    )
    expect(warned).toMatchObject({
        items: [{ key: 'e1.a', kind: 'warning', text: 'Not a valid option' }],
        canComplete: true,
    })
})

test('a cell’s own error and warning are listed as their value type made them, not translated again', async () => {
    // Made in French when the value was refused; one French text happens to be a key of its own.
    i18n.addResources('xx', 'translation', {
        'Saisissez un nombre entier': 'Ne pas traduire deux fois',
    })
    await i18n.changeLanguage('xx')
    try {
        const summary = summarise(
            {
                'e1.a': {
                    ...FILLED,
                    draft: 'abc',
                    error: 'Saisissez un nombre entier',
                },
                'e1.b': { ...FILLED, warning: 'Option non valide' },
            },
            {},
            NO_ROW_MESSAGES,
            TABLES
        )
        expect(summary.items.map(({ text }) => text)).toEqual([
            'Saisissez un nombre entier',
            'Option non valide',
        ])
    } finally {
        await i18n.changeLanguage('en')
    }
})

test('an empty slot’s required fields are not summary items', () => {
    const effects: Partial<Record<CellKey, TrackerEffects>> = {}
    for (let person = 0; person < 25; person += 1) {
        for (let slot = 0; slot < 4; slot += 1) {
            for (const field of ['a', 'b']) {
                effects[`s${person}-${slot}.${field}`] = {
                    required: true,
                    messages: [],
                }
            }
        }
    }
    const summarised = (typed?: string) =>
        summarise(
            {},
            effects,
            NO_ROW_MESSAGES,
            TABLES,
            undefined,
            (record) => record !== typed
        )
    expect(summarised()).toMatchObject({ items: [], canComplete: true })
    expect(summarised('s3-2').items).toHaveLength(2)
    expect(summarised('s3-2').canComplete).toBe(false)
})
