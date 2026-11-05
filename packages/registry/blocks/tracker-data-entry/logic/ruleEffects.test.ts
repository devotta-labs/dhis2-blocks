import type { Attribution, RuleEffects } from '@/components/program-rules'
import { rowRuleOutcome, ruleRowsCache, ruleRowsOf } from './ruleEffects'

const by = (ruleName: string): Attribution => ({
    ruleId: ruleName,
    ruleName,
    actionId: `${ruleName} action`,
    condition: 'true',
    readsFields: [],
})

// Built here: the block's index loads the app runtime, which needs a browser.
const effectsWith = (edit: Partial<RuleEffects>): RuleEffects => ({
    hiddenFields: new Map(),
    hiddenSections: new Map(),
    mandatoryFields: new Map(),
    assignedValues: new Map(),
    messages: new Map(),
    hiddenOptions: new Map(),
    optionGroups: new Map(),
    optionAttributions: new Map(),
    displayTexts: [],
    keyValuePairs: [],
    hiddenProgramStages: new Set(),
    programStageAttributions: new Map(),
    ...edit,
})

type Row = Parameters<typeof rowRuleOutcome>[1]

const row = (edit: Partial<Row> = {}): Row => ({
    stageFields: new Set(['a', 'b', 'r', 'f1', 'f2', 'opt', 'multi']),
    required: new Set(),
    options: new Map(),
    multiText: new Set(),
    optionGroups: new Map(),
    sections: new Map(),
    ...edit,
})

test('clears a hidden field’s value unless assigned', () => {
    const hide = { hiddenFields: new Map([['a', [by('Hide if age < 5')]]]) }

    const cleared = rowRuleOutcome(effectsWith(hide), row())
    expect(cleared.assignments).toEqual(new Map([['a', null]]))
    // Rule names are shown as DHIS2 gives them, not HTML-escaped.
    expect(cleared.cells.get('a')?.hiddenBy).toBe(
        'Hidden by rule: Hide if age < 5'
    )
    expect(cleared.cells.get('a')?.readOnly).toBeUndefined()

    const assigned = rowRuleOutcome(
        effectsWith({
            ...hide,
            assignedValues: new Map([['a', { value: 'x', by: by('Set A') }]]),
        }),
        row()
    )
    expect(assigned.assignments).toEqual(new Map([['a', 'x']]))
    expect(assigned.cells.get('a')).toMatchObject({
        hiddenBy: 'Hidden by rule: Hide if age < 5',
        readOnly: 'Assigned by rule: Set A',
    })
})

test('never hides a required field', () => {
    const outcome = rowRuleOutcome(
        effectsWith({
            hiddenFields: new Map([['r', [by('Hide R')]]]),
            hiddenSections: new Map([['s', [by('Hide S')]]]),
            mandatoryFields: new Map([['b', [by('Need B')]]]),
        }),
        row({ required: new Set(['r']), sections: new Map([['s', ['b']]]) })
    )
    for (const field of ['r', 'b']) {
        expect(outcome.cells.get(field)?.required).toBe(true)
        expect(outcome.cells.get(field)?.hiddenBy).toBeUndefined()
    }
    expect(outcome.cells.get('a')?.required).toBe(false)
    expect(outcome.assignments.size).toBe(0)
})

test('hiding a section hides its fields', () => {
    const outcome = rowRuleOutcome(
        effectsWith({
            hiddenSections: new Map([
                ['s', [by('Hide S')]],
                ['of another stage', [by('Hide T')]],
            ]),
        }),
        row({
            sections: new Map([
                ['s', ['f1', 'f2']],
                ['t', ['a']],
            ]),
        })
    )
    expect(outcome.cells.get('f1')?.hiddenBy).toBe('Hidden by rule: Hide S')
    expect(outcome.cells.get('f2')?.hiddenBy).toBe('Hidden by rule: Hide S')
    expect(outcome.cells.get('a')?.hiddenBy).toBeUndefined()
    // A hidden section keeps its fields' values.
    expect(outcome.assignments.size).toBe(0)
})

test('a HIDEFIELD clears its field; a hidden section does not', () => {
    const outcome = rowRuleOutcome(
        effectsWith({
            hiddenFields: new Map([['a', [by('Hide A')]]]),
            hiddenSections: new Map([['s', [by('Hide S')]]]),
        }),
        row({ sections: new Map([['s', ['f1']]]) })
    )
    expect(outcome.cells.get('a')?.hiddenBy).toBe('Hidden by rule: Hide A')
    expect(outcome.cells.get('f1')?.hiddenBy).toBe('Hidden by rule: Hide S')
    expect(outcome.assignments).toEqual(new Map([['a', null]]))
})

test('an assigned value outside the option set clears the field', () => {
    const assign = (field: string, value: string | null) =>
        rowRuleOutcome(
            effectsWith({
                assignedValues: new Map([[field, { value, by: by('Set') }]]),
            }),
            row({
                options: new Map([
                    ['opt', new Set(['A', 'B'])],
                    ['multi', new Set(['A', 'B'])],
                ]),
                multiText: new Set(['multi']),
            })
        ).assignments.get(field)

    expect(assign('opt', 'A')).toBe('A')
    expect(assign('opt', 'C')).toBeNull()
    // Only a MULTI_TEXT value is a list of codes.
    expect(assign('opt', 'A,B')).toBeNull()
    expect(assign('multi', 'A,B')).toBe('A,B')
    expect(assign('multi', 'A,C')).toBeNull()
    expect(assign('a', 'free text')).toBe('free text')
    expect(assign('a', '')).toBeNull()
    expect(assign('a', null)).toBeNull()
})

test('drops assignments outside the row’s stage', () => {
    const outcome = rowRuleOutcome(
        effectsWith({
            assignedValues: new Map([
                ['elsewhere', { value: '1', by: by('Set') }],
            ]),
            hiddenFields: new Map([['also elsewhere', [by('Hide')]]]),
            messages: new Map([
                [
                    'elsewhere',
                    [{ kind: 'error', text: 'Too high', by: by('Max') }],
                ],
            ]),
        }),
        row()
    )
    expect(outcome.assignments.size).toBe(0)
    expect(outcome.cells.has('elsewhere')).toBe(false)
    expect(outcome.cells.has('also elsewhere')).toBe(false)
})

test('hides the options of hidden groups, and every option outside the shown groups', () => {
    const hiddenOptions = (edit: Partial<RuleEffects>) =>
        rowRuleOutcome(
            effectsWith(edit),
            row({
                options: new Map([['opt', new Set(['A', 'B', 'C', 'D'])]]),
                optionGroups: new Map([
                    ['g1', new Set(['A', 'B'])],
                    ['g2', new Set(['C'])],
                ]),
            })
        ).cells.get('opt')?.hiddenOptions

    expect(hiddenOptions({})).toBeUndefined()
    expect(
        hiddenOptions({
            hiddenOptions: new Map([['opt', new Set(['D'])]]),
            optionGroups: new Map([
                ['opt', { hidden: new Set(['g1']), shown: new Set() }],
            ]),
        })
    ).toEqual(new Set(['A', 'B', 'D']))
    expect(
        hiddenOptions({
            optionGroups: new Map([
                ['opt', { hidden: new Set(), shown: new Set(['g2']) }],
            ]),
        })
    ).toEqual(new Set(['A', 'B', 'D']))
})

test('form messages keep their kind; row notes collect display texts and key-value pairs', () => {
    const outcome = rowRuleOutcome(
        effectsWith({
            messages: new Map([
                [
                    'form',
                    [
                        {
                            kind: 'warning',
                            text: 'Check the visit date',
                            by: by('Dates'),
                        },
                    ],
                ],
                ['a', [{ kind: 'error', text: 'Too high', by: by('Max') }]],
            ]),
            displayTexts: [
                {
                    location: 'feedback',
                    label: 'Gest. age',
                    value: '10+2',
                    by: by('Gest'),
                },
            ],
            keyValuePairs: [
                {
                    location: 'indicators',
                    label: 'High risk',
                    value: '',
                    by: by('Risk'),
                },
            ],
        }),
        row()
    )
    expect(outcome.rowMessages).toEqual([
        { tone: 'warning', text: 'Check the visit date', source: 'rule' },
    ])
    expect(outcome.notes).toEqual(['Gest. age 10+2', 'High risk'])
    expect(outcome.cells.get('a')?.messages).toEqual([
        { tone: 'error', text: 'Too high', source: 'rule' },
    ])
})

test('an error on complete becomes an error tone marked on complete', () => {
    const outcome = rowRuleOutcome(
        effectsWith({
            messages: new Map([
                [
                    'f',
                    [
                        { kind: 'errorOnComplete', text: 'Late', by: by('A') },
                        { kind: 'error', text: 'Now', by: by('B') },
                    ],
                ],
            ]),
        }),
        row({ stageFields: new Set(['f']) })
    )
    expect(outcome.cells.get('f')?.messages).toEqual([
        { tone: 'error', text: 'Late', source: 'rule', onComplete: true },
        { tone: 'error', text: 'Now', source: 'rule' },
    ])
})

test('a rule row holds every field of its stage, shown or not', () => {
    const [row] = ruleRowsOf(
        new Map([
            [
                'r1',
                {
                    kind: 'event',
                    id: 'r1',
                    programStageId: 's1',
                    orgUnitId: 'ou',
                    status: 'ACTIVE',
                },
            ],
        ]),
        new Map([['s1', new Set(['a', 'b'])]]),
        {
            'r1.a': { value: '1', sync: 'idle', source: 'person' },
            'r1.b': { value: '2', sync: 'idle', source: 'person' },
            'r1.occurredAt': {
                value: '2026-10-01',
                sync: 'idle',
                source: 'person',
            },
        }
    )
    expect(row?.event).toMatchObject({
        id: 'r1',
        programStageId: 's1',
        orgUnitId: 'ou',
        status: 'ACTIVE',
        dataValues: { a: '1', b: '2' },
        occurredAt: '2026-10-01',
    })
})

test("a new where-slot event's rules see its where values", () => {
    const slotEvent = {
        kind: 'event' as const,
        id: 'n1',
        programStageId: 's1',
        orgUnitId: 'ou',
        status: 'ACTIVE' as const,
        isNew: true,
        slot: 'bcg',
        createdWith: { vaccine: 'BCG', dose: '0' },
    }
    const rows = (cells: Record<string, string>) =>
        ruleRowsOf(
            new Map([['n1', slotEvent]]),
            new Map([['s1', new Set(['vaccine', 'dose', 'weight'])]]),
            Object.fromEntries(
                Object.entries(cells).map(([k, value]) => [
                    `n1.${k}`,
                    { value, sync: 'idle' as const, source: 'person' as const },
                ])
            )
        )[0]?.event.dataValues
    expect(rows({ weight: '4' })).toEqual({
        vaccine: 'BCG',
        dose: '0',
        weight: '4',
    })
    expect(rows({ weight: '4', dose: '2' })).toMatchObject({ dose: '2' })
    // No cell entry: createdWith stays. A cleared cell (entry, no value): the field is absent.
    expect(rows({ weight: '4' })).toMatchObject({ dose: '0' })
    expect(rows({ weight: '4', dose: '' })).toEqual({
        vaccine: 'BCG',
        weight: '4',
    })
})

test('the rule rows stay one array while the records and cells are the same objects', () => {
    const records = new Map([
        [
            'r1',
            {
                kind: 'event' as const,
                id: 'r1',
                programStageId: 's1',
                orgUnitId: 'ou',
                status: 'ACTIVE' as const,
            },
        ],
    ])
    const rowsOf = ruleRowsCache(new Map([['s1', new Set(['a'])]]))
    const cells = {
        'r1.a': {
            value: '1',
            sync: 'idle' as const,
            source: 'person' as const,
        },
    }
    const rows = rowsOf(records, cells)
    expect(rowsOf(records, cells)).toBe(rows)
    const changed = { 'r1.a': { ...cells['r1.a'], value: '2' } }
    const again = rowsOf(records, changed)
    expect(again).not.toBe(rows)
    expect(again[0]?.event.dataValues).toEqual({ a: '2' })
    expect(rowsOf(new Map(records), changed)).not.toBe(again)
})
