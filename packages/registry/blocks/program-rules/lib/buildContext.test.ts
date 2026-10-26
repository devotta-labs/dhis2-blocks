import * as engine from '@dhis2/rule-engine'
import {
    currentEventVariable,
    eventInput,
    programMetadata,
    rule,
} from '../__tests__/metadata'
import { RMNCH, rmnchInput, rmnchMetadata } from '../__tests__/rmnch'
import { buildRuleContext } from './buildContext'
import { buildEngineInput } from './buildInput'
import type { EventRuleInput, ProgramRulesMetadata, RuleContext } from './types'

/** Raw engine effects, so these tests don't depend on effect normalisation. */
const rawEffects = (context: RuleContext, input: EventRuleInput) => {
    const built = buildEngineInput(engine, context, input)
    return context.engine
        .evaluateEvent(
            built.event,
            built.enrollment,
            built.otherEvents,
            context.engineContext
        )
        .map((effect) => ({
            type: effect.ruleAction.type,
            data: effect.data,
            values: Object.fromEntries(effect.ruleAction.values),
        }))
}

const hides = (metadata: ProgramRulesMetadata, input: EventRuleInput) =>
    rawEffects(buildRuleContext(engine, metadata), input).some(
        (effect) => effect.type === 'HIDEFIELD'
    )

const hideX = [{ id: 'hide', type: 'HIDEFIELD', dataElementId: 'x' }]

describe('buildRuleContext', () => {
    // Spike pitfall 3.
    it('leaves out the three RMNCH rules the engine cannot parse', () => {
        const context = buildRuleContext(engine, rmnchMetadata())
        expect(context.invalidRules).toHaveLength(3)
        for (const invalid of context.invalidRules) {
            expect(invalid.expression).toContain('!==')
            expect(invalid.message).toMatch(/^expected name/)
            expect(invalid.actionId).toBeUndefined()
            expect(context.ruleInfo.has(invalid.ruleId)).toBe(false)
        }
        expect(
            context.invalidRules.map((invalid) => invalid.ruleName)
        ).toContain('Hide fields to specyfy allergies unless the woman ')
        expect(context.rules).toHaveLength(15)
    })

    it('leaves out an unparseable action and keeps the rest of its rule', () => {
        const context = buildRuleContext(
            engine,
            programMetadata({
                rules: [
                    rule('r1', 'true', [
                        {
                            id: 'bad',
                            type: 'DISPLAYTEXT',
                            data: 'd2:unknownFn(1)',
                        },
                        { id: 'good', type: 'HIDEFIELD', dataElementId: 'x' },
                    ]),
                ],
            })
        )
        expect(context.invalidRules).toEqual([
            {
                ruleId: 'r1',
                ruleName: 'rule r1',
                actionId: 'bad',
                expression: 'd2:unknownFn(1)',
                message: expect.stringMatching(/^Unknown function/),
            },
        ])
        expect([...(context.ruleInfo.get('r1')?.actions.keys() ?? [])]).toEqual(
            ['good']
        )
        expect(context.rules[0]?.actions).toHaveLength(1)
    })

    it('keeps expressions that only fail the type check', () => {
        const context = buildRuleContext(engine, rmnchMetadata())
        const kept = [...context.ruleInfo.values()].map(
            (info) => info.condition
        )
        expect(kept).toContain('!#{chronicconditions}')
        expect(kept).toContain("d2:hasValue('lmp')")
    })

    // Spike pitfall 4.
    it('registers variables under their name, not their display name', () => {
        const metadata = programMetadata({
            variables: [currentEventVariable('weight', 'w')],
            rules: [rule('r1', '#{weight} > 10', hideX)],
        })
        expect(hides(metadata, eventInput({ w: '20' }))).toBe(true)
        expect(hides(metadata, eventInput({ w: '5' }))).toBe(false)
    })

    // Spike pitfall 5.
    it('reads option names unless the variable uses codes', () => {
        const optionSets = [
            { id: 'os', options: [{ code: 'Y', name: 'Yes please' }] },
        ]
        const metadata = (useCodeForOptionSet: boolean, condition: string) =>
            programMetadata({
                optionSets,
                variables: [
                    currentEventVariable('answer', 'a', {
                        optionSetId: 'os',
                        useCodeForOptionSet,
                    }),
                ],
                rules: [rule('r1', condition, hideX)],
            })
        expect(
            hides(
                metadata(false, "#{answer} == 'Yes please'"),
                eventInput({ a: 'Y' })
            )
        ).toBe(true)
        expect(
            hides(metadata(true, "#{answer} == 'Y'"), eventInput({ a: 'Y' }))
        ).toBe(true)
    })

    // Spike pitfall 6.
    it('keys constants by uid and passes their values as strings', () => {
        const metadata = programMetadata({
            constants: [{ id: 'Gfd3ppDfq8E', value: 5.0 }],
            rules: [rule('r1', 'C{Gfd3ppDfq8E} == 5', hideX)],
        })
        expect(hides(metadata, eventInput())).toBe(true)
    })

    // Spike pitfall 7.
    it('splits an ASSIGN into a content form and, when it differs, a field form', () => {
        const metadata = (dataElementId: string) =>
            programMetadata({
                variables: [currentEventVariable('a', 'fieldA')],
                rules: [
                    rule('r1', 'true', [
                        {
                            id: 'assign',
                            type: 'ASSIGN',
                            content: '#{a}',
                            data: "'x'",
                            dataElementId,
                        },
                    ]),
                ],
            })
        const actions = (context: RuleContext) =>
            context.rules[0]?.actions.map((action) =>
                Object.fromEntries(action.values)
            )
        expect(actions(buildRuleContext(engine, metadata('fieldA')))).toEqual([
            { id: 'assign', ruleId: 'r1', content: '#{a}' },
        ])
        expect(actions(buildRuleContext(engine, metadata('fieldB')))).toEqual([
            { id: 'assign', ruleId: 'r1', content: '#{a}' },
            {
                id: 'assign',
                ruleId: 'r1',
                field: 'fieldB',
                attributeType: 'DATA_ELEMENT',
            },
        ])
    })

    // Spike pitfall 8.
    it('sets attributeType on every action', () => {
        const context = buildRuleContext(engine, rmnchMetadata())
        const types = context.rules.flatMap((converted) =>
            converted.actions.map((action) =>
                action.values.get('attributeType')
            )
        )
        expect(new Set(types)).toEqual(
            new Set(['DATA_ELEMENT', 'TRACKED_ENTITY_ATTRIBUTE', 'UNKNOWN'])
        )
    })

    // Spike pitfall 10.
    it('matches org unit groups by id and by code', () => {
        const metadata = (group: string) =>
            programMetadata({
                orgUnitGroups: [
                    { id: 'g1', code: 'MCHP', orgUnitIds: ['ou1'] },
                ],
                rules: [rule('r1', `d2:inOrgUnitGroup('${group}')`, hideX)],
            })
        expect(hides(metadata('MCHP'), eventInput({}, 'ou1'))).toBe(true)
        expect(hides(metadata('g1'), eventInput({}, 'ou1'))).toBe(true)
        expect(hides(metadata('g1'), eventInput({}, 'ou2'))).toBe(false)
    })

    it('reports what data the rules need', () => {
        expect(buildRuleContext(engine, rmnchMetadata()).requirements).toEqual({
            enrollment: true,
            otherEvents: true,
            orgUnitGroups: [],
        })
        expect(
            buildRuleContext(
                engine,
                programMetadata({
                    variables: [currentEventVariable('x', 'x')],
                    rules: [rule('r1', '#{x} > 1', hideX)],
                })
            ).requirements
        ).toEqual({ enrollment: false, otherEvents: false, orgUnitGroups: [] })
        expect(
            buildRuleContext(
                engine,
                programMetadata({
                    rules: [rule('r1', "d2:inOrgUnitGroup('MCHP')", hideX)],
                })
            ).requirements.orgUnitGroups
        ).toEqual(['MCHP'])
    })

    it('evaluates RMNCH through the converted context', () => {
        const context = buildRuleContext(engine, rmnchMetadata())
        const hidden = rawEffects(
            context,
            rmnchInput({ [RMNCH.chronic]: 'false' })
        )
            .filter((effect) => effect.type === 'HIDEFIELD')
            .map((effect) => effect.values.field)
        expect(hidden).toEqual(
            expect.arrayContaining([...RMNCH.chronicFollowUps])
        )
    })

    it('collects option group members and stage names', () => {
        const context = buildRuleContext(
            engine,
            programMetadata({
                rules: [
                    rule('r1', 'true', [
                        {
                            id: 'a',
                            type: 'HIDEOPTIONGROUP',
                            dataElementId: 'x',
                            optionGroup: { id: 'og', optionCodes: ['1', '2'] },
                        },
                    ]),
                ],
            })
        )
        expect(context.optionGroupOptions).toEqual(
            new Map([['og', new Set(['1', '2'])]])
        )
        expect(context.stageNames.get('stage')).toBe('Stage')
    })
})
