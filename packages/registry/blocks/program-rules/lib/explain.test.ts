import { blameLine, displayWith } from '@/components/event-form/lib/explain'
import {
    by,
    CHILD_VISIT_GROUPS,
    childVisitForm,
} from '@/components/event-form/test/forms'
import { emptyEffects } from './evaluate'
import { explain } from './explain'
import type { BlameContext } from './explain'
import { overlay } from './overlay'
import type { RuleValues as Values } from './overlay'
import type {
    RuleDependencies,
    RuleDependencyGraph,
    RuleEffects,
} from './types'

const form = childVisitForm()
const outcomeOf = (entered: Values, changes: Partial<RuleEffects>) =>
    overlay(
        entered,
        { ...emptyEffects(), ...changes },
        form,
        CHILD_VISIT_GROUPS
    )

const dependencies = (readsProgramVariables: string[]) =>
    ({
        readsVariables: [],
        readsProgramVariables,
        readsConstants: [],
        readsOrgUnitGroups: [],
        readsFields: [],
        writesFields: [],
        writesValues: [],
        writesVariables: [],
        writesSections: [],
        writesProgramStages: [],
    }) satisfies RuleDependencies

const contextOf = (
    effective: Values,
    graph?: RuleDependencyGraph,
    stored: Values = {}
) =>
    ({
        form,
        graph,
        effective,
        stored,
        eventDate: '2026-11-02',
        display: displayWith(
            { calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' },
            new Map()
        ),
    }) satisfies BlameContext

const HIDE_PREGNANT = by(
    'Hide pregnancy for men',
    ['labSexCode1', 'attribute01'],
    "#{sex} == 'M'"
)

describe('explain', () => {
    it('blames a hidden field with the answers its rule read, by label and display value', () => {
        const entered = { labSexCode1: 'M', labPregnant: 'true' }
        const outcome = outcomeOf(entered, {
            hiddenFields: new Map([['labPregnant', [HIDE_PREGNANT]]]),
        })
        const blames = explain(outcome, contextOf(outcome.effective))
        expect(blames.get('labPregnant')).toEqual([
            {
                effect: 'hidden',
                ruleName: 'Hide pregnancy for men',
                condition: "#{sex} == 'M'",
                because: [
                    { fieldId: 'labSexCode1', label: 'Sex', value: 'Male' },
                ],
                value: 'Yes',
                stored: false,
            },
        ])
        const held = explain(
            outcome,
            contextOf(outcome.effective, undefined, { labPregnant: 'true' })
        )
        expect(held.get('labPregnant')?.[0].stored).toBe(true)
    })

    it('lists what the rule read outside the form after the form’s answers, with where it came from', () => {
        const outcome = outcomeOf(
            { labSexCode1: 'M' },
            { hiddenFields: new Map([['labPregnant', [HIDE_PREGNANT]]]) }
        )
        const outside = new Map([
            [
                'attribute01',
                {
                    label: 'Sex at registration',
                    value: 'M',
                    valueType: 'TEXT',
                    options: [{ code: 'M', name: 'Male' }],
                    variable: 'sexAtRegistration',
                    from: { kind: 'enrollment' as const },
                },
            ],
        ])
        const blames = explain(outcome, {
            ...contextOf(outcome.effective),
            outside,
        })
        expect(blames.get('labPregnant')?.[0].because).toEqual([
            { fieldId: 'labSexCode1', label: 'Sex', value: 'Male' },
            {
                fieldId: 'attribute01',
                label: 'Sex at registration',
                value: 'Male',
                from: { kind: 'enrollment' },
            },
        ])
    })

    it('lists a form field the rule reads in the previous event with that event’s answer too', () => {
        const smaller = by(
            'Losing weight',
            ['labWeight01'],
            '#{weight} < #{prevWeight}'
        )
        const outcome = outcomeOf(
            { labWeight01: '60' },
            {
                messages: new Map([
                    [
                        'labWeight01',
                        [{ kind: 'warning', text: 'Lost weight', by: smaller }],
                    ],
                ]),
            }
        )
        const previous = {
            label: 'weight',
            value: '65',
            valueType: 'NUMBER',
            from: {
                kind: 'event' as const,
                stage: 'Child visit',
                previous: true as const,
            },
        }
        const graph = (readsVariables: string[]) =>
            ({
                rules: new Map([
                    [smaller.ruleId, { ...dependencies([]), readsVariables }],
                ]),
                fieldReaders: new Map(),
                fieldWriters: new Map(),
            }) satisfies RuleDependencyGraph
        const because = (readsVariables: string[], variable: string) =>
            explain(outcome, {
                ...contextOf(outcome.effective, graph(readsVariables)),
                outside: new Map([['labWeight01', { ...previous, variable }]]),
            }).get('labWeight01')?.[0].because
        expect(because(['weight', 'prevWeight'], 'prevWeight')).toEqual([
            { fieldId: 'labWeight01', label: 'Weight (kg)', value: '60' },
            {
                fieldId: 'labWeight01',
                label: 'Weight (kg)',
                value: '65',
                from: previous.from,
            },
        ])
        expect(because(['weight'], 'prevWeight')).toEqual([
            { fieldId: 'labWeight01', label: 'Weight (kg)', value: '60' },
        ])
    })

    it('says a read field with no answer is not answered', () => {
        const outcome = outcomeOf(
            {},
            {
                mandatoryFields: new Map([
                    ['labMalaria1', [by('Fever', ['labTempC001'])]],
                ]),
            }
        )
        const [blame] = explain(outcome, contextOf({})).get('labMalaria1') ?? []
        expect(blame).toMatchObject({
            effect: 'required',
            because: [
                {
                    fieldId: 'labTempC001',
                    label: 'Temperature (°C)',
                    value: undefined,
                },
            ],
        })
        expect(blameLine(blame, 'Malaria test')).toBe(
            'Required by rule "Fever" because Temperature (°C) is not answered'
        )
    })

    it('names an assigned option by its name', () => {
        const outcome = outcomeOf(
            { labDanger01: 'LETHARGY' },
            {
                assignedValues: new Map([
                    [
                        'labOutcome1',
                        {
                            value: 'CLINIC',
                            by: by('Refer', ['labDanger01']),
                        },
                    ],
                ]),
            }
        )
        const [blame] =
            explain(outcome, contextOf(outcome.effective)).get('labOutcome1') ??
            []
        expect(blame).toMatchObject({
            effect: 'assigned',
            value: 'Referred to clinic',
            because: [{ label: 'Danger signs', value: 'Lethargy' }],
        })
        expect(blameLine(blame, 'Outcome')).toBe(
            'Set by rule "Refer" because Danger signs is Lethargy'
        )
    })

    it('adds the event date when the rule reads it', () => {
        const future = by('Visit date in the future', [])
        const outcome = outcomeOf(
            {},
            {
                messages: new Map([
                    [
                        'form',
                        [{ kind: 'error', text: 'In the future', by: future }],
                    ],
                ]),
            }
        )
        const graph: RuleDependencyGraph = {
            rules: new Map([[future.ruleId, dependencies(['event_date'])]]),
            fieldReaders: new Map(),
            fieldWriters: new Map(),
        }
        const [blame] = explain(outcome, contextOf({}, graph)).get('form') ?? []
        expect(blame).toMatchObject({
            effect: 'message',
            because: [{ fieldId: 'occurredAt', label: 'Visit date' }],
        })
        expect(blame.because[0].value).toMatch(/2026/)
    })

    it('blames fields hidden through their section, and a fully hidden section', () => {
        const follow = by('Follow-up after referral', ['labOutcome1'])
        const outcome = outcomeOf(
            { labOutcome1: 'HOME' },
            { hiddenSections: new Map([['labSecFollw', [follow]]]) }
        )
        const blames = explain(outcome, contextOf(outcome.effective))
        expect(blames.get('labFollowUp')?.[0].effect).toBe('sectionHidden')
        expect(blames.get('labSecFollw')).toEqual([
            {
                effect: 'sectionHidden',
                ruleName: 'Follow-up after referral',
                condition: 'true',
                because: [
                    {
                        fieldId: 'labOutcome1',
                        label: 'Outcome',
                        value: 'Sent home',
                    },
                ],
            },
        ])
    })

    it('blames removed options and field messages', () => {
        const rule = by('Fever', ['labTempC001'])
        const outcome = outcomeOf(
            { labTempC001: '39' },
            {
                hiddenOptions: new Map([
                    ['labMalaria1', new Set(['NOT_DONE'])],
                ]),
                optionAttributions: new Map([['labMalaria1', [rule]]]),
                messages: new Map([
                    [
                        'labTempC001',
                        [{ kind: 'warning', text: 'Fever', by: rule }],
                    ],
                ]),
            }
        )
        const blames = explain(outcome, contextOf(outcome.effective))
        expect(blames.get('labMalaria1')?.[0].effect).toBe('options')
        expect(blames.get('labTempC001')?.[0]).toMatchObject({
            effect: 'message',
            value: 'Fever',
        })
        expect(blameLine(blames.get('labMalaria1')![0], 'Malaria test')).toBe(
            'Some options removed by rule "Fever" because Temperature (°C) is 39'
        )
    })
})
