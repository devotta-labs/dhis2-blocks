import { emptyEffects, overlay } from '@/components/program-rules'
import type { RuleEffects, RuleMessage } from '@/components/program-rules'
import { by, CHILD_VISIT_GROUPS, childVisitForm } from '../__tests__/forms'
import type { ChildVisitVariant } from '../__tests__/childVisit'
import type { Values } from './metadata'
import { EVENT_DATE, futureProblem, LOCATION, validate } from './validate'
import type { ValidationInput } from './validate'

const RULE = by('Rule')
const message = (kind: RuleMessage['kind'], text: string): RuleMessage => ({
    kind,
    text,
    by: RULE,
})

const inputOf = ({
    entered = { labWeight01: '12' },
    changes = {},
    variant,
    ...rest
}: Partial<Omit<ValidationInput, 'form' | 'outcome'>> & {
    entered?: Values
    changes?: Partial<RuleEffects>
    variant?: ChildVisitVariant
}): ValidationInput => {
    const form = childVisitForm(variant)
    return {
        form,
        outcome: overlay(
            entered,
            { ...emptyEffects(), ...changes },
            form,
            CHILD_VISIT_GROUPS
        ),
        problems: new Map(),
        eventDate: '2026-11-02',
        status: 'ACTIVE',
        categories: {},
        orgUnits: new Set(),
        calendar: 'iso8601',
        ...rest,
    }
}

const ON_COMPLETE: ChildVisitVariant = { validationStrategy: 'ON_COMPLETE' }

describe('validate', () => {
    it('passes a filled form', () => {
        expect(validate(inputOf({}), 'save')).toEqual({
            invalid: [],
            formErrors: [],
            warningsOnComplete: [],
        })
    })

    it('never finds a hidden field invalid', () => {
        const input = inputOf({
            changes: {
                hiddenFields: new Map([['labTempC001', [RULE]]]),
                messages: new Map([
                    ['labTempC001', [message('error', 'Too hot')]],
                ]),
            },
            problems: new Map([['labTempC001', 'Not a number']]),
        })
        expect(validate(input, 'complete').invalid).toEqual([])
    })

    it('ignores the value problem of a field a rule sets', () => {
        const input = inputOf({
            changes: {
                assignedValues: new Map([
                    ['labDoseMg01', { value: '24', by: RULE }],
                ]),
            },
            problems: new Map([['labDoseMg01', 'Not a number']]),
        })
        expect(validate(input, 'save').invalid).toEqual([])
    })

    it('blocks on value problems and the event date’s problem whatever the strategy', () => {
        const input = inputOf({
            variant: ON_COMPLETE,
            problems: new Map([
                ['labTempC001', 'Not a number'],
                [EVENT_DATE, 'Not a date'],
            ]),
        })
        expect(validate(input, 'save').invalid).toEqual([
            { fieldId: EVENT_DATE, text: 'Not a date' },
            { fieldId: 'labTempC001', text: 'Not a number' },
        ])
    })

    it('blocks on a future date the stage refuses whatever the strategy, and passes one it allows', () => {
        const entered = { labWeight01: '12', labFollowUp: '2999-01-01' }
        expect(
            validate(
                inputOf({
                    entered,
                    variant: { ...ON_COMPLETE, futureFollowUp: false },
                }),
                'save'
            ).invalid
        ).toEqual([
            {
                fieldId: 'labFollowUp',
                text: 'A date in the future is not allowed',
            },
        ])
        expect(
            validate(inputOf({ entered, variant: ON_COMPLETE }), 'save').invalid
        ).toEqual([])
    })

    const strict = {
        entered: {},
        eventDate: undefined,
        changes: {
            messages: new Map([
                ['labTempC001', [message('error', 'Too hot')]],
                ['form', [message('error', 'In the future')]],
            ]),
        },
    }

    it('blocks on required fields, the event date and rule errors on every attempt under ON_UPDATE_AND_INSERT', () => {
        const result = validate(inputOf(strict), 'save')
        expect(result.invalid).toEqual([
            { fieldId: EVENT_DATE, text: 'Required' },
            { fieldId: 'labWeight01', text: 'Required' },
            { fieldId: 'labTempC001', text: 'Too hot' },
        ])
        expect(result.formErrors).toEqual(['In the future'])
    })

    it('blocks on all but the event date only when completing under ON_COMPLETE', () => {
        const input = inputOf({ ...strict, variant: ON_COMPLETE })
        expect(validate(input, 'save')).toEqual({
            invalid: [{ fieldId: EVENT_DATE, text: 'Required' }],
            formErrors: [],
            warningsOnComplete: [],
        })
        expect(validate(input, 'complete').invalid).toHaveLength(3)
        expect(validate(input, 'complete').formErrors).toEqual([
            'In the future',
        ])
    })

    it('blocks on errors on complete only when completing', () => {
        const input = inputOf({
            changes: {
                messages: new Map([
                    [
                        'labPregnant',
                        [message('errorOnComplete', 'Answer Pregnant')],
                    ],
                    ['form', [message('errorOnComplete', 'Not yet')]],
                ]),
            },
        })
        expect(validate(input, 'save').invalid).toEqual([])
        expect(validate(input, 'complete')).toMatchObject({
            invalid: [{ fieldId: 'labPregnant', text: 'Answer Pregnant' }],
            formErrors: ['Not yet'],
        })
    })

    it('checks a completed event’s save as a complete', () => {
        const input = inputOf({
            status: 'COMPLETED',
            changes: {
                messages: new Map([
                    [
                        'labPregnant',
                        [message('errorOnComplete', 'Answer Pregnant')],
                    ],
                ]),
            },
        })
        expect(validate(input, 'save').invalid).toHaveLength(1)
    })

    it('lists warnings on complete of shown fields and the form', () => {
        const input = inputOf({
            changes: {
                hiddenFields: new Map([['labPregnant', [RULE]]]),
                messages: new Map([
                    [
                        'labWeight01',
                        [message('warningOnComplete', 'Check the weight')],
                    ],
                    ['labPregnant', [message('warningOnComplete', 'Hidden')]],
                    ['form', [message('warningOnComplete', 'Check the form')]],
                ]),
            },
        })
        expect(validate(input, 'complete')).toEqual({
            invalid: [],
            formErrors: [],
            warningsOnComplete: [
                'Weight (kg): Check the weight',
                'Check the form',
            ],
        })
    })
})

describe('categories', () => {
    const FUNDED: ChildVisitVariant = { categories: true }
    const ORG_UNITS = new Set(['labCountry1', 'labDistrct1', 'labOrgUnit1'])
    const chosen = { labCatFund1: 'labCoGovt01', labCatOutr1: 'labCoMobile' }

    it('requires each category on Save and Complete, under either strategy', () => {
        for (const variant of [FUNDED, { ...FUNDED, ...ON_COMPLETE }]) {
            for (const attempt of ['save', 'complete'] as const) {
                expect(
                    validate(inputOf({ variant, orgUnits: ORG_UNITS }), attempt)
                        .invalid
                ).toEqual([
                    { fieldId: 'labCatFund1', text: 'Required' },
                    { fieldId: 'labCatOutr1', text: 'Required' },
                ])
            }
        }
    })

    it('passes options that apply, and says why a chosen one does not', () => {
        expect(
            validate(
                inputOf({
                    variant: FUNDED,
                    orgUnits: ORG_UNITS,
                    categories: chosen,
                }),
                'save'
            ).invalid
        ).toEqual([])
        expect(
            validate(
                inputOf({
                    variant: FUNDED,
                    orgUnits: ORG_UNITS,
                    categories: chosen,
                    eventDate: '2025-12-31',
                }),
                'save'
            ).invalid
        ).toEqual([
            {
                fieldId: 'labCatOutr1',
                text: expect.stringMatching(/^Mobile clinic starts on /),
            },
        ])
    })

    it('puts the event date first, then the categories, the location, then the fields', () => {
        const { invalid } = validate(
            inputOf({
                variant: { ...FUNDED, featureType: 'POINT' },
                entered: {},
                eventDate: undefined,
                problems: new Map([[LOCATION, 'Enter a valid coordinate']]),
            }),
            'save'
        )
        expect(invalid.map(({ fieldId }) => fieldId)).toEqual([
            EVENT_DATE,
            'labCatFund1',
            'labCatOutr1',
            LOCATION,
            'labWeight01',
        ])
    })
})

describe('location', () => {
    it('is not required, but a location typed that is not one blocks every attempt', () => {
        const variant: ChildVisitVariant = {
            ...ON_COMPLETE,
            featureType: 'POINT',
        }
        expect(validate(inputOf({ variant }), 'complete').invalid).toEqual([])
        expect(
            validate(
                inputOf({
                    variant,
                    problems: new Map([[LOCATION, 'Enter a valid coordinate']]),
                }),
                'save'
            ).invalid
        ).toEqual([{ fieldId: LOCATION, text: 'Enter a valid coordinate' }])
    })
})

describe('futureProblem', () => {
    const form = childVisitForm({ futureFollowUp: false })
    const followUp = form.fields.get('labFollowUp')!
    const refused = 'A date in the future is not allowed'

    it('refuses a stored day after today, of a date or a date and time', () => {
        expect(futureProblem(followUp, '2026-11-17', '2026-11-16')).toBe(
            refused
        )
        expect(
            futureProblem(
                { ...followUp, field: { valueType: 'DATETIME' } },
                '2026-11-17T00:10',
                '2026-11-16'
            )
        ).toBe(refused)
    })

    it('passes today, a past day and no value', () => {
        expect(futureProblem(followUp, '2026-11-16T23:59', '2026-11-16')).toBe(
            undefined
        )
        expect(futureProblem(followUp, '2026-01-01', '2026-11-16')).toBe(
            undefined
        )
        expect(futureProblem(followUp, undefined, '2026-11-16')).toBe(undefined)
    })

    it('passes a future day where the stage allows one, and other value types', () => {
        expect(
            futureProblem(
                childVisitForm().fields.get('labFollowUp')!,
                '2026-11-17',
                '2026-11-16'
            )
        ).toBe(undefined)
        expect(
            futureProblem(
                { ...followUp, field: { valueType: 'TEXT' } },
                '2026-11-17',
                '2026-11-16'
            )
        ).toBe(undefined)
    })
})
