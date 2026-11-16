import * as engine from '@dhis2/rule-engine'
import { Result } from 'better-result'
import {
    currentEventVariable,
    programMetadata,
    rule,
} from '../__tests__/metadata'
import { buildRuleContext } from './buildContext'
import { evaluateEventRules } from './evaluate'
import { runRules, settleRules } from './overlay'
import type { RuleForm, RuleSettled, RuleValues } from './overlay'
import type { ProgramRuleMetadata, RuleEventInput } from './types'

const FIELDS = ['weight', 'dose', 'daily', 'temp', 'flag', 'notes']

const form: RuleForm = {
    fields: new Map(
        FIELDS.map((id) => [
            id,
            {
                id,
                label: id,
                compulsory: false,
                field: { valueType: id === 'notes' ? 'TEXT' : 'NUMBER' },
            },
        ])
    ),
    sections: [{ id: 'stage', fieldIds: FIELDS }],
    eventDateLabel: 'Visit date',
}

/** Weight → dose → daily total, a warning on the temperature, and whatever `extra` adds. */
const rulesWith = (extra: ProgramRuleMetadata[] = []) => {
    const context = buildRuleContext(
        engine,
        programMetadata({
            // Named apart from the data elements, as in DHIS2: an ASSIGN to a data element is read on the next run.
            variables: FIELDS.map((id) =>
                currentEventVariable(`${id}Var`, id, {
                    fieldValueType: id === 'notes' ? 'TEXT' : 'NUMBER',
                })
            ),
            rules: [
                rule(
                    'dose',
                    "d2:hasValue('weightVar')",
                    [
                        {
                            id: 'dose',
                            type: 'ASSIGN',
                            dataElementId: 'dose',
                            data: '#{weightVar} * 2',
                        },
                    ],
                    { priority: 1 }
                ),
                rule(
                    'daily',
                    "d2:hasValue('doseVar')",
                    [
                        {
                            id: 'daily',
                            type: 'ASSIGN',
                            dataElementId: 'daily',
                            data: '#{doseVar} * 4',
                        },
                    ],
                    { priority: 2 }
                ),
                rule('fever', '#{tempVar} > 38', [
                    {
                        id: 'fever',
                        type: 'SHOWWARNING',
                        dataElementId: 'temp',
                        content: 'Fever',
                    },
                ]),
                ...extra,
            ],
        })
    )
    let runs = 0
    const evaluate = (event: RuleEventInput) => {
        runs += 1
        return Result.try(() =>
            evaluateEventRules(engine, context, { event, otherEvents: [] })
        )
    }
    const event = {
        id: 'event',
        programStageId: 'stage',
        occurredAt: '2026-03-12',
        orgUnitId: 'ou',
        status: 'ACTIVE' as const,
    }
    const settle = (
        last: RuleSettled | undefined,
        entered: RuleValues,
        occurredAt = event.occurredAt
    ) => {
        runs = 0
        const settled = settleRules(
            last,
            entered,
            { ...event, occurredAt },
            {
                context,
                evaluate,
                form,
                optionGroups: new Map(),
                maxRuns: 4,
            }
        )
        if (settled.isErr()) throw settled.error
        return { settled: settled.value, runs }
    }
    const cold = (entered: RuleValues, occurredAt = event.occurredAt) => {
        const run = runRules(
            entered,
            (values) =>
                evaluate({ ...event, occurredAt, dataValues: { ...values } }),
            form,
            new Map(),
            4
        )
        if (run.isErr()) throw run.error
        return run.value
    }
    return { settle, cold }
}

describe('settleRules', () => {
    it('settles a chain from the entered values when nothing came before', () => {
        const { settle, cold } = rulesWith()
        const { settled, runs } = settle(undefined, { weight: '10' })
        expect(runs).toBe(3)
        expect(settled.outcome.effective).toEqual({
            weight: '10',
            dose: '20',
            daily: '80',
        })
        expect(settled.outcome).toEqual(cold({ weight: '10' }).outcome)
    })

    it('runs no rule for a field none reads, and keeps the settled effects', () => {
        const { settle, cold } = rulesWith()
        const first = settle(undefined, { weight: '10' }).settled
        const { settled, runs } = settle(first, {
            weight: '10',
            notes: 'calm',
        })
        expect(runs).toBe(0)
        expect(settled.effects).toBe(first.effects)
        expect(settled.outcome).toEqual(
            cold({ weight: '10', notes: 'calm' }).outcome
        )
    })

    it('confirms an untouched chain in one run from the values it settled on', () => {
        const { settle, cold } = rulesWith()
        const first = settle(undefined, { weight: '10' }).settled
        const { settled, runs } = settle(first, { weight: '10', temp: '39' })
        expect(runs).toBe(1)
        expect(settled.outcome).toEqual(
            cold({ weight: '10', temp: '39' }).outcome
        )
        expect(settled.outcome.messages.get('temp')?.[0]?.text).toBe('Fever')
    })

    it('works a changed chain through and drops what the rules no longer set', () => {
        const { settle, cold } = rulesWith()
        const first = settle(undefined, { weight: '10' }).settled
        const changed = settle(first, { weight: '12' }).settled
        expect(changed.outcome).toEqual(cold({ weight: '12' }).outcome)
        const cleared = settle(changed, {}).settled
        expect(cleared.outcome.effective).toEqual({})
        expect(cleared.outcome).toEqual(cold({}).outcome)
    })

    it('settles from the entered values when rules feed each other in a loop', () => {
        // Keeps itself set once set: from the last values a warm start would keep `flag` after it is cleared.
        const { settle, cold } = rulesWith([
            rule('sticky', "#{flagVar} == '1'", [
                {
                    id: 'sticky',
                    type: 'ASSIGN',
                    dataElementId: 'flag',
                    data: "'1'",
                },
            ]),
        ])
        const set = settle(undefined, { flag: '1' }).settled
        expect(set.outcome.effective).toEqual({ flag: '1' })
        const cleared = settle(set, { weight: '10' }).settled
        expect(cleared.outcome).toEqual(cold({ weight: '10' }).outcome)
        expect(cleared.outcome.effective.flag).toBeUndefined()
    })

    it('runs again for a new event date only when a rule reads it', () => {
        const plain = rulesWith()
        const first = plain.settle(undefined, { weight: '10' }).settled
        expect(plain.settle(first, { weight: '10' }, '2026-04-01').runs).toBe(0)

        const dated = rulesWith([
            rule('late', "d2:daysBetween('2026-04-01', V{event_date}) > 0", [
                {
                    id: 'late',
                    type: 'SHOWWARNING',
                    dataElementId: 'notes',
                    content: 'Late',
                },
            ]),
        ])
        const before = dated.settle(undefined, { weight: '10' }).settled
        const after = dated.settle(before, { weight: '10' }, '2026-04-02')
        expect(after.runs).toBe(1)
        expect(after.settled.outcome).toEqual(
            dated.cold({ weight: '10' }, '2026-04-02').outcome
        )
        expect(after.settled.outcome.messages.has('notes')).toBe(true)
    })
})
