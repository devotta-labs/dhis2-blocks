import { emptyEffects, overlay } from '@/components/program-rules'
import type {
    Blame,
    BlameContext,
    RuleDependencyGraph,
    RuleEffects,
} from '@/components/program-rules'
import { by, CHILD_VISIT_GROUPS, childVisitForm } from '../__tests__/forms'
import {
    blameLead,
    blameLine,
    displayWith,
    markerOf,
    reasonLabel,
    ruleChanges,
} from './explain'
import type { Values } from './metadata'

const form = childVisitForm()
const outcomeOf = (entered: Values, changes: Partial<RuleEffects>) =>
    overlay(
        entered,
        { ...emptyEffects(), ...changes },
        form,
        CHILD_VISIT_GROUPS
    )

const contextOf = (
    effective: Values,
    graph?: RuleDependencyGraph,
    stored: Values = {}
): BlameContext => ({
    form,
    graph,
    effective,
    stored,
    eventDate: '2026-11-02',
    display: displayWith(
        { calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' },
        new Map()
    ),
})

const HIDE_PREGNANT = by(
    'Hide pregnancy for men',
    ['labSexCode1', 'attribute01'],
    "#{sex} == 'M'"
)

describe('blameLine', () => {
    const blame = (changes: Partial<Blame>): Blame => ({
        effect: 'assigned',
        ruleName: 'Paracetamol dose',
        condition: 'd2:hasValue(#{weight})',
        because: [
            { fieldId: 'labWeight01', label: 'Weight (kg)', value: '150' },
        ],
        ...changes,
    })

    it('says who set a value and why', () => {
        expect(blameLine(blame({ value: '300' }), 'Dose')).toBe(
            'Set by rule "Paracetamol dose" because Weight (kg) is 150'
        )
    })

    it('says who cleared a value', () => {
        expect(blameLine(blame({ because: [] }), 'Dose')).toBe(
            'Cleared by rule "Paracetamol dose"'
        )
    })

    it('says who hid a field, and that saving removes the answer DHIS2 holds', () => {
        expect(
            blameLine(
                blame({
                    effect: 'hidden',
                    ruleName: 'Hide pregnancy for men',
                    because: [
                        { fieldId: 'labSexCode1', label: 'Sex', value: 'Male' },
                    ],
                    value: 'Yes',
                    stored: true,
                }),
                'Pregnant'
            )
        ).toBe(
            'Pregnant: hidden by rule "Hide pregnancy for men" because Sex is Male. Your answer "Yes" will be removed when you save.'
        )
    })

    it('says who hid a field, and which answer is not saved', () => {
        expect(
            blameLine(
                blame({
                    effect: 'hidden',
                    ruleName: 'Hide pregnancy for men',
                    because: [
                        { fieldId: 'labSexCode1', label: 'Sex', value: 'Male' },
                    ],
                    value: 'Yes',
                }),
                'Pregnant'
            )
        ).toBe(
            'Pregnant: hidden by rule "Hide pregnancy for men" because Sex is Male. Your answer "Yes" is not saved while it is hidden.'
        )
    })

    it('shows three reasons and counts the rest', () => {
        const because = ['A', 'B', 'C', 'D', 'E'].map((label) => ({
            fieldId: label,
            label,
            value: '1',
        }))
        expect(blameLine(blame({ effect: 'required', because }), 'Dose')).toBe(
            'Required by rule "Paracetamol dose" because A is 1, B is 1, C is 1, and 2 more'
        )
    })
})

describe('blameLead', () => {
    const blame = (changes: Partial<Blame>): Blame => ({
        effect: 'assigned',
        ruleName: 'Paracetamol dose',
        condition: 'd2:hasValue(#{weight})',
        because: [
            { fieldId: 'labWeight01', label: 'Weight (kg)', value: '150' },
        ],
        ...changes,
    })

    it.each([
        [{ value: '300' }, 'Set to 300 because Weight (kg) is 150.'],
        [{}, 'Cleared because Weight (kg) is 150.'],
        [{ effect: 'required' }, 'Required because Weight (kg) is 150.'],
        [
            { effect: 'options' },
            'Some options removed because Weight (kg) is 150.',
        ],
        [
            { effect: 'message', value: 'Check the weight' },
            'Check the weight because Weight (kg) is 150.',
        ],
        [{ value: '300', because: [] }, 'Set to 300'],
    ] satisfies Array<[Partial<Blame>, string]>)(
        '%o says %s',
        (changes, said) => {
            expect(blameLead(blame(changes))).toBe(said)
        }
    )

    it('names three answers and counts the rest', () => {
        const because = ['A', 'B', 'C', 'D', 'E'].map((label) => ({
            fieldId: label,
            label,
            value: '1',
        }))
        expect(blameLead(blame({ effect: 'required', because }))).toBe(
            'Required because A is 1, B is 1, C is 1, and 2 more.'
        )
    })
})

describe('markerOf', () => {
    const of = (...effects: Blame['effect'][]) =>
        markerOf(
            effects.map((effect) => ({
                effect,
                ruleName: 'Rule',
                condition: 'true',
                because: [],
            }))
        )

    it('says the main effect', () => {
        expect(of('message', 'options', 'assigned')).toBe('Set automatically')
        expect(of('options', 'required')).toBe('Required here')
        expect(of('message', 'options')).toBe('Fewer options')
        expect(of('message')).toBeUndefined()
    })
})

describe('ruleChanges', () => {
    const DOSE = by('Paracetamol dose', ['labWeight01'])

    it('says nothing when nothing changed', () => {
        const outcome = outcomeOf({}, {})
        expect(ruleChanges(outcome, outcome, contextOf({}))).toBe('')
    })

    it('lists values set or cleared and fields hidden or shown again', () => {
        const before = outcomeOf(
            { labSexCode1: 'F', labDoseMg01: '20', labDailyMg1: '80' },
            {
                assignedValues: new Map([
                    ['labDoseMg01', { value: '20', by: DOSE }],
                    ['labDailyMg1', { value: '80', by: DOSE }],
                ]),
                hiddenFields: new Map([['labFollowUp', [DOSE]]]),
            }
        )
        const after = outcomeOf(
            { labSexCode1: 'M' },
            {
                assignedValues: new Map([
                    ['labDoseMg01', { value: '300', by: DOSE }],
                    ['labDailyMg1', { value: null, by: DOSE }],
                ]),
                hiddenFields: new Map([['labPregnant', [HIDE_PREGNANT]]]),
            }
        )
        expect(ruleChanges(before, after, contextOf(after.effective))).toBe(
            'Paracetamol dose (mg) set to 300. Daily total (mg) cleared. Pregnant hidden. Follow-up date shown.'
        )
    })

    it('says a field is required, or not, once a rule changes it', () => {
        const fever = by('Fever', ['labTempC001'])
        const before = outcomeOf({}, {})
        const after = outcomeOf(
            { labTempC001: '39' },
            { mandatoryFields: new Map([['labMalaria1', [fever]]]) }
        )
        expect(ruleChanges(before, after, contextOf(after.effective))).toBe(
            'Malaria test required.'
        )
        expect(ruleChanges(after, before, contextOf({}))).toBe(
            'Malaria test not required.'
        )
    })
})

describe('reasonLabel', () => {
    it('says where an answer read outside the form came from', () => {
        const reason = { fieldId: 'attr', label: 'Age', value: '17' }
        expect(reasonLabel(reason)).toBe('Age')
        expect(reasonLabel({ ...reason, from: { kind: 'enrollment' } })).toBe(
            'Age (from the enrolment)'
        )
        expect(
            reasonLabel({
                ...reason,
                label: 'Gestational age',
                from: { kind: 'event', stage: 'ANC first visit' },
            })
        ).toBe('Gestational age (ANC first visit)')
        expect(reasonLabel({ ...reason, from: { kind: 'event' } })).toBe(
            'Age (another event)'
        )
        expect(
            reasonLabel({
                ...reason,
                from: { kind: 'event', stage: 'Child visit', previous: true },
            })
        ).toBe('Age (previous event)')
    })

    it('names an outside answer with its origin in the sentence', () => {
        expect(
            blameLead({
                effect: 'required',
                ruleName: 'Teenage pregnancy',
                condition: 'A{age} < 18',
                because: [
                    {
                        fieldId: 'attr',
                        label: 'Age',
                        value: '17',
                        from: { kind: 'enrollment' },
                    },
                ],
            })
        ).toBe('Required because Age (from the enrolment) is 17.')
    })
})
