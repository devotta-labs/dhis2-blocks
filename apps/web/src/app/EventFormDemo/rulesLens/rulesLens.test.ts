import type { EventFormRules } from '@dhis2-blocks/event-form'
import { parseCondition } from './condition'
import {
    changedAnswers,
    diffEffects,
    effectMap,
    effectsByTarget,
    fieldLens,
    groupChanges,
} from './effects'

type Effects = NonNullable<EventFormRules['effects']>
type Graph = NonNullable<EventFormRules['graph']>

const by = (ruleId: string, actionId: string) => ({
    ruleId,
    ruleName: `Rule ${ruleId}`,
    actionId,
    condition: '',
    readsFields: [],
})

const emptyEffects = (): Effects => ({
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
})

const graph: Graph = {
    rules: new Map([
        [
            'hideFollowUps',
            {
                readsVariables: [],
                readsProgramVariables: [],
                readsConstants: [],
                readsOrgUnitGroups: [],
                readsFields: ['chronic'],
                writesFields: ['diabetes', 'hypertension'],
                writesVariables: [],
                writesSections: [],
                writesProgramStages: [],
            },
        ],
    ]),
    fieldReaders: new Map([['chronic', ['hideFollowUps']]]),
    fieldWriters: new Map([
        ['diabetes', ['hideFollowUps']],
        ['hypertension', ['hideFollowUps']],
    ]),
}

describe('parseCondition', () => {
    const variables = new Map([
        ['chronicconditions', 'chronic'],
        ['lmp', 'lmpDate'],
    ])

    it('spells out operators and marks the answers a condition reads', () => {
        expect(
            parseCondition(
                "!#{chronicconditions} && d2:hasValue('lmp')",
                variables
            )
        ).toEqual([
            { kind: 'text', text: 'not ' },
            {
                kind: 'field',
                name: 'chronicconditions',
                fieldId: 'chronic',
            },
            { kind: 'text', text: ' and ' },
            { kind: 'field', name: 'lmp', fieldId: 'lmpDate' },
            { kind: 'text', text: ' has a value' },
        ])
    })

    it('keeps comparisons, literals and program variables', () => {
        expect(
            parseCondition("#{lmp} != '' || V{event_date} == 'x'", variables)
        ).toEqual([
            { kind: 'field', name: 'lmp', fieldId: 'lmpDate' },
            { kind: 'text', text: " ≠ '' or " },
            { kind: 'field', name: 'event_date' },
            { kind: 'text', text: " = 'x'" },
        ])
    })

    it('reads d2:hasValue of a variable reference and leaves constants as written', () => {
        expect(
            parseCondition('!d2:hasValue(#{lmp}) || C{k} > 2', variables)
        ).toEqual([
            { kind: 'text', text: 'not ' },
            { kind: 'field', name: 'lmp', fieldId: 'lmpDate' },
            { kind: 'text', text: ' has a value or C{k} > 2' },
        ])
    })
})

describe('effect changes', () => {
    it('reports effects that started, stopped and assignments that changed', () => {
        const before = emptyEffects()
        before.hiddenFields.set('diabetes', [by('hideFollowUps', 'h1')])
        before.hiddenFields.set('hypertension', [by('hideFollowUps', 'h2')])
        before.assignedValues.set('age', { value: '14', by: by('ga', 'a1') })
        const after = emptyEffects()
        after.assignedValues.set('age', { value: '15', by: by('ga', 'a1') })
        after.messages.set('form', [
            { kind: 'warningOnComplete', text: 'Check', by: by('w', 'm1') },
        ])

        const changes = diffEffects(effectMap(before), effectMap(after))

        expect(
            groupChanges(changes).map((group) => [
                group.kind,
                group.direction,
                group.targetIds,
                group.detail,
            ])
        ).toEqual([
            ['assigned', 'changed', ['age'], '15'],
            ['warning', 'started', ['form'], 'Check'],
            ['hidden', 'stopped', ['diabetes', 'hypertension'], undefined],
        ])
    })

    it('finds the answers that changed, leaving out assigned fields', () => {
        expect(
            changedAnswers(
                { chronic: 'false', age: '14' },
                { chronic: 'true', age: '15', lmp: '2026-07-01' },
                new Set(['age'])
            )
        ).toEqual(['chronic', 'lmp'])
    })
})

describe('fieldLens', () => {
    it('separates rules acting on a field from rules that could', () => {
        const effects = emptyEffects()
        effects.hiddenFields.set('diabetes', [by('hideFollowUps', 'h1')])
        effects.mandatoryFields.set('diabetes', [by('req', 'r1')])
        const explain = (id: string) =>
            id === 'diabetes'
                ? [by('hideFollowUps', 'h1'), by('req', 'r1')]
                : []

        expect(
            fieldLens(effectsByTarget(effects), graph, explain, 'diabetes')
        ).toEqual({
            acting: [
                { by: by('hideFollowUps', 'h1'), kinds: ['hidden'] },
                { by: by('req', 'r1'), kinds: ['mandatory'] },
            ],
            dormant: [],
            controls: [],
            controllers: [],
        })
        expect(
            fieldLens(
                effectsByTarget(emptyEffects()),
                graph,
                () => [],
                'hypertension'
            )
        ).toMatchObject({ acting: [], dormant: ['hideFollowUps'] })
        expect(
            fieldLens(
                effectsByTarget(emptyEffects()),
                graph,
                () => [],
                'chronic'
            )
        ).toMatchObject({
            controls: ['diabetes', 'hypertension'],
            controllers: ['hideFollowUps'],
        })
    })
})
