import {
    programSchema,
    stageFormOf,
} from '@/components/event-form/lib/metadata'
import type { Values } from '@/components/event-form/lib/metadata'
import { addDaysIso, todayIso } from '@/components/dhis2-value-types'
import {
    buildRuleContext,
    evaluateEventRules,
    metadataForStage,
    outsideReads,
    runRules,
    type RuleEffects,
} from '@/components/program-rules/lib'
import {
    RuleEnrollmentResponseSchema,
    toRuleEnrollmentData,
} from '@/components/program-rules/hooks/enrollment'
import { loadRuleEngine } from '@/components/program-rules/hooks/loadRuleEngine'
import {
    ProgramRulesResponseSchema,
    toProgramRulesMetadata,
} from '@/components/program-rules/hooks/metadata'
import { Result } from 'better-result'
import { describe, expect, it } from 'vitest'
import { EXAMPLES, type Example } from '../labData'

/** The example's rules, built and run by the real engine, as the form's hooks do. */
const rulesOf = async (example: Example) => {
    const engine = await loadRuleEngine()
    const lab = EXAMPLES[example]
    const metadata = metadataForStage(
        toProgramRulesMetadata(
            ProgramRulesResponseSchema.parse({
                rules: lab.rules,
                variables: lab.variables,
                constants: lab.constants,
                program: lab.program,
                me: lab.me,
            })
        ),
        lab.programStageId
    )
    const context = buildRuleContext(engine, metadata)
    const form = stageFormOf(
        programSchema.parse(lab.program),
        lab.programStageId
    )
    if (form === undefined) throw new Error(`${example} has no stage form`)
    let evaluations = 0
    const evaluate = (values: Values, occurredAt = todayIso()) => {
        evaluations++
        return Result.ok(
            evaluateEventRules(engine, context, {
                event: {
                    id: 'labNewEvnt1',
                    programStageId: lab.programStageId,
                    orgUnitId: lab.orgUnitId,
                    status: 'ACTIVE',
                    occurredAt,
                    dataValues: { ...values },
                },
                otherEvents: [],
            })
        )
    }
    /** Every run until the values settle, as the form runs them. */
    const run = (values: Values, occurredAt?: string) => {
        evaluations = 0
        const outcome = runRules(
            values,
            (each) => evaluate(each, occurredAt),
            form,
            context.optionGroupOptions,
            4
        )
        if (outcome.isErr()) throw outcome.error
        return { ...outcome.value, evaluations }
    }
    return { context, run }
}

describe('the event form lab data, on the real rule engine', () => {
    it('builds Child visit and Long form without invalid rules, and RMNCH with its three', async () => {
        expect((await rulesOf('newVisit')).context.invalidRules).toEqual([])
        expect((await rulesOf('longForm')).context.invalidRules).toEqual([])
        expect((await rulesOf('rmnch')).context.invalidRules).toHaveLength(3)
    })

    it('warns on and requires RMNCH smoking from the birth date and the Care at birth stage, and names both', async () => {
        const engine = await loadRuleEngine()
        const { context } = await rulesOf('rmnch')
        const lab = EXAMPLES.rmnch
        const data = toRuleEnrollmentData(
            RuleEnrollmentResponseSchema.parse(lab.enrollment)
        )
        const event = data.events.find(({ id }) => id === lab.eventId)
        if (event === undefined) throw new Error('RMNCH lost its event')
        const input = {
            event,
            enrollment: data.enrollment,
            otherEvents: data.events,
        }
        expect(
            evaluateEventRules(engine, context, input)
                .messages.get('sWoqcoByYmD')
                ?.map(({ text }) => text)
        ).toEqual(['Ask again about smoking before the birth.'])
        expect(
            evaluateEventRules(engine, context, input).mandatoryFields.has(
                'sWoqcoByYmD'
            )
        ).toBe(true)
        const reads = outsideReads(context, input)
        expect(reads.get('gHGyrwKPzej')).toMatchObject({
            label: 'Birth date',
            value: '1991-01-18',
            from: { kind: 'enrollment' },
        })
        expect(reads.get('V5PR8Kw8ZnC')).toMatchObject({
            label: 'WHOMCH Pregnancy outcome',
            value: undefined,
            from: { kind: 'event', stage: 'Care at birth' },
        })
    })

    it('chains weight 150 to a dose of 300, a daily total of 1200 and its summary in three runs', async () => {
        const { run } = await rulesOf('newVisit')
        const { outcome, evaluations } = run({ labWeight01: '150' })
        expect(outcome.effective.labDoseMg01).toBe('300')
        expect(outcome.effective.labDailyMg1).toBe('1200')
        expect(outcome.display.at(-1)).toMatchObject({
            label: 'Daily total (mg)',
            value: '1200',
        })
        expect(evaluations).toBe(3)
    })

    it('fires every effect of the Child visit list for some input', async () => {
        const { run } = await rulesOf('newVisit')
        const effects = (values: Values, occurredAt?: string): RuleEffects =>
            run(values, occurredAt).effects
        const kinds = (found: RuleEffects, fieldId: string) =>
            found.messages.get(fieldId)?.map(({ kind }) => kind)

        const heavy = effects({ labWeight01: '150' })
        expect(heavy.assignedValues.get('labDoseMg01')?.value).toBe('300')
        expect(heavy.displayTexts.map(({ label }) => label)).toEqual([
            'Give paracetamol every 6 hours',
        ])
        expect(heavy.keyValuePairs.map(({ value }) => value)).toEqual(['1200'])
        expect(kinds(heavy, 'labWeight01')).toEqual(['warningOnComplete'])

        const male = effects({ labSexCode1: 'M' })
        expect(male.hiddenFields.has('labPregnant')).toBe(true)
        expect(male.assignedValues.get('labPregnant')?.value).toBe('false')

        expect(effects({}).hiddenSections.has('labSecFollw')).toBe(true)
        expect(
            effects({ labOutcome1: 'CLINIC' }).hiddenSections.has('labSecFollw')
        ).toBe(false)

        const fever = effects({ labTempC001: '39' })
        expect(fever.mandatoryFields.has('labMalaria1')).toBe(true)
        expect(kinds(fever, 'labTempC001')).toEqual(['warning'])
        expect([...(fever.hiddenOptions.get('labMalaria1') ?? [])]).toEqual([
            'NOT_DONE',
        ])
        expect(kinds(effects({ labTempC001: '44' }), 'labTempC001')).toContain(
            'error'
        )

        expect(kinds(effects({ labSexCode1: 'F' }), 'labPregnant')).toEqual([
            'errorOnComplete',
        ])
        expect([
            ...(effects({ labDanger01: 'LETHARGY' }).optionGroups.get(
                'labOutcome1'
            )?.shown ?? []),
        ]).toEqual(['labGrpRefer'])
        expect([
            ...(effects({ labWeight01: '2' }).optionGroups.get('labOutcome1')
                ?.hidden ?? []),
        ]).toEqual(['labGrpHome1'])

        expect(kinds(effects({}, addDaysIso(todayIso(), 2)), 'form')).toEqual([
            'error',
        ])
    })

    it('runs the Long form chain and hides its fields', async () => {
        const { run } = await rulesOf('longForm')
        const { outcome } = run({ f001: '120', f002: 'skip' })
        expect(outcome.effective.f003).toBe('240')
        expect(outcome.effective.f005).toBe('250')
        expect(outcome.effective.f141).toBe('250')
        expect(outcome.hidden.has('f007')).toBe(true)
        expect(outcome.hidden.has('f004')).toBe(true)
    })
})
