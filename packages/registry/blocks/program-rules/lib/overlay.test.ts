import { Result } from 'better-result'
import {
    by,
    CHILD_VISIT_GROUPS,
    childVisitForm,
} from '@/components/event-form/__tests__/forms'
import { emptyEffects } from './evaluate'
import { overlay, runRules } from './overlay'
import type { RuleValues as Values } from './overlay'
import type { Attribution, RuleEffects } from './types'

const form = childVisitForm()
const effects = (changes: Partial<RuleEffects>): RuleEffects => ({
    ...emptyEffects(),
    ...changes,
})
const outcomeOf = (entered: Values, changes: Partial<RuleEffects>) =>
    overlay(entered, effects(changes), form, CHILD_VISIT_GROUPS)

const HIDE_PREGNANT = by('Hide pregnancy for men', ['labSexCode1'])
const HIDE_PATIENT = by('Hide patient', ['labWeight01'])

describe('overlay', () => {
    it('leaves the entered values as they are without effects', () => {
        const entered = { labWeight01: '12' }
        const outcome = outcomeOf(entered, {})
        expect(outcome.effective).toEqual(entered)
        expect(outcome.hidden.size).toBe(0)
        expect([...outcome.required]).toEqual(['labWeight01'])
    })

    it('counts only the stage’s fields', () => {
        const outcome = outcomeOf(
            {},
            {
                hiddenFields: new Map([['elsewhere1', [HIDE_PREGNANT]]]),
                assignedValues: new Map([
                    ['elsewhere1', { value: '1', by: HIDE_PREGNANT }],
                ]),
                mandatoryFields: new Map([['elsewhere1', [HIDE_PREGNANT]]]),
                messages: new Map([
                    [
                        'elsewhere1',
                        [{ kind: 'error', text: 'x', by: HIDE_PREGNANT }],
                    ],
                ]),
            }
        )
        expect(outcome.hidden.size).toBe(0)
        expect(outcome.assigned.size).toBe(0)
        expect(outcome.effective).toEqual({})
        expect(outcome.required.has('elsewhere1')).toBe(false)
        expect(outcome.messages.has('elsewhere1')).toBe(false)
    })

    it('never hides a required field', () => {
        const outcome = outcomeOf(
            { labWeight01: '12', labMalaria1: 'POS' },
            {
                hiddenFields: new Map([
                    ['labWeight01', [HIDE_PREGNANT]],
                    ['labMalaria1', [HIDE_PREGNANT]],
                ]),
                mandatoryFields: new Map([['labMalaria1', [HIDE_PATIENT]]]),
            }
        )
        expect(outcome.hidden.size).toBe(0)
        expect(outcome.effective).toEqual({
            labWeight01: '12',
            labMalaria1: 'POS',
        })
        expect(outcome.requiredBy.get('labMalaria1')).toBe(HIDE_PATIENT)
        expect(outcome.requiredBy.has('labWeight01')).toBe(false)
    })

    it('names a field’s own HIDEFIELD rule before its section’s', () => {
        const outcome = outcomeOf(
            {},
            {
                hiddenSections: new Map([['labSecPatnt', [HIDE_PATIENT]]]),
                hiddenFields: new Map([['labPregnant', [HIDE_PREGNANT]]]),
            }
        )
        expect(outcome.hidden.get('labPregnant')).toEqual({
            by: HIDE_PREGNANT,
            section: false,
        })
        expect(outcome.hidden.get('labSexCode1')).toEqual({
            by: HIDE_PATIENT,
            section: true,
        })
    })

    it('clears a hidden field’s value and says which answer is not saved', () => {
        const entered = { labSexCode1: 'M', labPregnant: 'true' }
        const outcome = outcomeOf(entered, {
            hiddenFields: new Map([['labPregnant', [HIDE_PREGNANT]]]),
        })
        expect(outcome.effective).toEqual({ labSexCode1: 'M' })
        expect(outcome.hidden.get('labPregnant')?.cleared).toBe('true')
        expect(entered).toEqual({ labSexCode1: 'M', labPregnant: 'true' })
    })

    it('keeps an assignment into a hidden field', () => {
        const outcome = outcomeOf(
            { labSexCode1: 'M', labPregnant: 'true' },
            {
                hiddenFields: new Map([['labPregnant', [HIDE_PREGNANT]]]),
                assignedValues: new Map([
                    [
                        'labPregnant',
                        { value: 'false', by: by('Pregnancy is no for men') },
                    ],
                ]),
            }
        )
        expect(outcome.effective.labPregnant).toBe('false')
        expect(outcome.hidden.get('labPregnant')?.cleared).toBeUndefined()
    })

    it('hides a section’s fields that are not required and keeps their values', () => {
        const outcome = outcomeOf(
            { labWeight01: '12', labTempC001: '37' },
            {
                hiddenSections: new Map([['labSecMeas1', [HIDE_PATIENT]]]),
            }
        )
        expect([...outcome.hidden.keys()]).toEqual([
            'labTempC001',
            'labDoseMg01',
            'labDailyMg1',
        ])
        expect(outcome.effective).toEqual({
            labWeight01: '12',
            labTempC001: '37',
        })
        expect(outcome.hiddenSections.size).toBe(0)
    })

    it('reports a section with no field left shown', () => {
        const follow = by('Follow-up after referral', ['labOutcome1'])
        const outcome = outcomeOf(
            {},
            { hiddenSections: new Map([['labSecFollw', [follow]]]) }
        )
        expect(outcome.hiddenSections).toEqual(
            new Map([['labSecFollw', follow]])
        )
    })

    it('assigns, clears on null or empty, and clears codes outside the options', () => {
        const rule = by('Assign')
        const outcome = outcomeOf(
            {
                labTempC001: '37',
                labDoseMg01: '5',
                labSexCode1: 'F',
                labDanger01: 'LETHARGY',
            },
            {
                assignedValues: new Map([
                    ['labWeight01', { value: '150', by: rule }],
                    ['labTempC001', { value: null, by: rule }],
                    ['labDoseMg01', { value: '', by: rule }],
                    ['labSexCode1', { value: 'X', by: rule }],
                    ['labDanger01', { value: 'LETHARGY,NOPE', by: rule }],
                    ['labOutcome1', { value: 'CLINIC', by: rule }],
                ]),
            }
        )
        expect(outcome.effective).toEqual({
            labWeight01: '150',
            labOutcome1: 'CLINIC',
        })
        expect(outcome.assigned.get('labWeight01')).toEqual({
            value: '150',
            by: rule,
        })
        expect(outcome.assigned.get('labSexCode1')).toEqual({
            value: undefined,
            by: rule,
        })
    })

    it('keeps every part of a MULTI_TEXT assignment that has an option', () => {
        const outcome = outcomeOf(
            {},
            {
                assignedValues: new Map([
                    [
                        'labDanger01',
                        { value: 'LETHARGY,VOMITING', by: by('Assign') },
                    ],
                ]),
            }
        )
        expect(outcome.effective.labDanger01).toBe('LETHARGY,VOMITING')
    })

    it('hides options, hidden groups and everything outside shown groups', () => {
        const rule = by('Options')
        const outcome = outcomeOf(
            {},
            {
                hiddenOptions: new Map([
                    ['labMalaria1', new Set(['NOT_DONE'])],
                ]),
                optionGroups: new Map([
                    [
                        'labOutcome1',
                        {
                            hidden: new Set(['labGrpHome1']),
                            shown: new Set(['labGrpRefer']),
                        },
                    ],
                ]),
                optionAttributions: new Map([
                    ['labMalaria1', [rule]],
                    ['labOutcome1', [rule]],
                ]),
            }
        )
        expect(outcome.hiddenOptions.get('labMalaria1')).toEqual(
            new Set(['NOT_DONE'])
        )
        expect(outcome.hiddenOptions.get('labOutcome1')).toEqual(
            new Set(['HOME'])
        )
        expect(outcome.optionsBy.get('labOutcome1')).toBe(rule)
    })

    it('hides every option outside a shown group', () => {
        const outcome = outcomeOf(
            {},
            {
                optionGroups: new Map([
                    [
                        'labOutcome1',
                        { hidden: new Set(), shown: new Set(['labGrpHome1']) },
                    ],
                ]),
            }
        )
        expect(outcome.hiddenOptions.get('labOutcome1')).toEqual(
            new Set(['CLINIC', 'HOSPITAL'])
        )
    })

    it('drops the messages of hidden fields, keeps form messages, and makes those outside the stage the form’s', () => {
        const message = (text: string) => ({
            kind: 'warning' as const,
            text,
            by: HIDE_PREGNANT,
        })
        const outcome = outcomeOf(
            {},
            {
                hiddenFields: new Map([['labPregnant', [HIDE_PREGNANT]]]),
                messages: new Map([
                    ['labPregnant', [message('gone')]],
                    ['labTempC001', [message('kept')]],
                    ['form', [message('form')]],
                    // An attribute's, or another stage's data element's.
                    ['labAttrib01', [message('outside')]],
                ]),
            }
        )
        expect([...outcome.messages.keys()]).toEqual(['labTempC001', 'form'])
        expect(outcome.messages.get('form')?.map(({ text }) => text)).toEqual([
            'form',
            'outside',
        ])
    })

    it('ignores HIDEPROGRAMSTAGE and lists display texts before key-value pairs', () => {
        const item = (label: string) => ({
            location: 'feedback' as const,
            label,
            value: '',
            by: HIDE_PREGNANT,
        })
        const outcome = outcomeOf(
            {},
            {
                hiddenProgramStages: new Set(['labChildStg']),
                keyValuePairs: [item('pair')],
                displayTexts: [item('text')],
            }
        )
        expect(outcome.display.map(({ label }) => label)).toEqual([
            'text',
            'pair',
        ])
        expect(outcome.hidden.size).toBe(0)
    })

    it('gives a field its answer back once it is shown again', () => {
        const entered = { labSexCode1: 'M', labPregnant: 'true' }
        outcomeOf(entered, {
            hiddenFields: new Map([['labPregnant', [HIDE_PREGNANT]]]),
        })
        expect(outcomeOf(entered, {}).effective.labPregnant).toBe('true')
    })
})

describe('runRules', () => {
    const DOSE = by('Paracetamol dose', ['labWeight01'])
    const DAILY = by('Daily total', ['labDoseMg01'])
    const SUMMARY = by('Dose summary', ['labDailyMg1'])

    /** Weight → dose → daily total → summary, as the rules engine would, one run at a time. */
    const chain = () => {
        const calls: Values[] = []
        const evaluate = (values: Values) => {
            calls.push(values)
            const assignedValues = new Map()
            if (values.labWeight01 !== undefined) {
                assignedValues.set('labDoseMg01', {
                    value: String(Number(values.labWeight01) * 2),
                    by: DOSE,
                })
            }
            if (values.labDoseMg01 !== undefined) {
                assignedValues.set('labDailyMg1', {
                    value: String(Number(values.labDoseMg01) * 4),
                    by: DAILY,
                })
            }
            const keyValuePairs =
                values.labDailyMg1 === undefined
                    ? []
                    : [
                          {
                              location: 'feedback' as const,
                              label: 'Daily total (mg)',
                              value: values.labDailyMg1,
                              by: SUMMARY,
                          },
                      ]
            return Result.ok(effects({ assignedValues, keyValuePairs }))
        }
        return { calls, evaluate }
    }

    it('runs again on what the rules set until the values settle', () => {
        const { calls, evaluate } = chain()
        const result = runRules(
            { labWeight01: '150' },
            evaluate,
            form,
            CHILD_VISIT_GROUPS,
            4
        )
        expect(calls).toEqual([
            { labWeight01: '150' },
            { labWeight01: '150', labDoseMg01: '300' },
            { labWeight01: '150', labDoseMg01: '300', labDailyMg1: '1200' },
        ])
        if (!Result.isOk(result)) throw result.error
        expect(result.value.outcome.effective).toEqual({
            labWeight01: '150',
            labDoseMg01: '300',
            labDailyMg1: '1200',
        })
        expect(result.value.outcome.display.map(({ value }) => value)).toEqual([
            '1200',
        ])
        expect(result.value.capped).toBe(false)
    })

    it('runs once when the rules change no value', () => {
        const { calls, evaluate } = chain()
        const result = runRules(
            { labTempC001: '37' },
            evaluate,
            form,
            CHILD_VISIT_GROUPS,
            4
        )
        expect(calls).toHaveLength(1)
        expect(Result.isOk(result)).toBe(true)
    })

    it('runs again when a hide clears a value', () => {
        let calls = 0
        const evaluate = () => {
            calls += 1
            return Result.ok(
                effects({
                    hiddenFields: new Map([['labPregnant', [HIDE_PREGNANT]]]),
                })
            )
        }
        runRules({ labPregnant: 'true' }, evaluate, form, CHILD_VISIT_GROUPS, 4)
        expect(calls).toBe(2)
    })

    it('stops at four runs when two fields hide each other', () => {
        let calls = 0
        const evaluate = (values: Values) => {
            calls += 1
            const hiddenFields = new Map<string, Attribution[]>()
            if (values.labTempC001 !== undefined) {
                hiddenFields.set('labPregnant', [HIDE_PREGNANT])
            }
            if (values.labPregnant !== undefined) {
                hiddenFields.set('labTempC001', [HIDE_PREGNANT])
            }
            return Result.ok(effects({ hiddenFields }))
        }
        const result = runRules(
            { labTempC001: '39', labPregnant: 'true' },
            evaluate,
            form,
            CHILD_VISIT_GROUPS,
            4
        )
        expect(calls).toBe(4)
        expect(Result.isOk(result) && result.value.capped).toBe(true)
    })

    it('returns an error from any run', () => {
        const failure = new Error('engine')
        const errorOf = (result: ReturnType<typeof runRules>) =>
            Result.isError(result) ? result.error : undefined
        expect(
            errorOf(
                runRules(
                    {},
                    () => Result.err(failure),
                    form,
                    CHILD_VISIT_GROUPS,
                    4
                )
            )
        ).toBe(failure)

        let calls = 0
        const second = () => {
            calls += 1
            return calls === 1
                ? Result.ok(
                      effects({
                          hiddenFields: new Map([
                              ['labPregnant', [HIDE_PREGNANT]],
                          ]),
                      })
                  )
                : Result.err(failure)
        }
        expect(
            errorOf(
                runRules(
                    { labPregnant: 'true' },
                    second,
                    form,
                    CHILD_VISIT_GROUPS,
                    4
                )
            )
        ).toBe(failure)
    })
})
