import * as engine from '@dhis2/rule-engine'
import {
    currentEventVariable,
    eventInput,
    programMetadata,
    rule,
} from '../__tests__/metadata'
import { RMNCH, rmnchInput, rmnchMetadata } from '../__tests__/rmnch'
import { buildRuleContext } from './buildContext'
import { evaluateEventRules, explainField } from './evaluate'
import type { ProgramRulesMetadata } from './types'

const rmnch = buildRuleContext(engine, rmnchMetadata())
const evaluateRmnch = (values: Record<string, string | null> = {}) =>
    evaluateEventRules(engine, rmnch, rmnchInput(values))
const evaluate = (metadata: ProgramRulesMetadata, values = {}) =>
    evaluateEventRules(
        engine,
        buildRuleContext(engine, metadata),
        eventInput(values)
    )

describe('evaluateEventRules on RMNCH', () => {
    it('hides the chronic condition follow-ups when there are none, with attribution', () => {
        const effects = evaluateRmnch({ [RMNCH.chronic]: 'false' })
        for (const field of RMNCH.chronicFollowUps) {
            expect(effects.hiddenFields.get(field)).toEqual([
                {
                    ruleId: expect.any(String),
                    ruleName:
                        'Hide all fields for chronic conitions unless the w',
                    actionId: expect.any(String),
                    condition: '!#{chronicconditions}',
                    readsFields: [RMNCH.chronic],
                },
            ])
        }
        const shown = evaluateRmnch({ [RMNCH.chronic]: 'true' })
        for (const field of RMNCH.chronicFollowUps) {
            expect(shown.hiddenFields.has(field)).toBe(false)
        }
    })

    it('assigns the gestational age from the LMP', () => {
        expect(
            evaluateRmnch({ [RMNCH.lmp]: '2026-01-01' }).assignedValues.get(
                RMNCH.gestationalAge
            )
        ).toEqual({
            value: '10',
            by: expect.objectContaining({
                ruleId: 'KRMEVVbex0q',
                actionId: 'oWFO8OtGZDX',
                readsFields: [RMNCH.lmp],
            }),
        })
    })

    it('shows the rule error on an LMP after the visit', () => {
        expect(
            evaluateRmnch({ [RMNCH.lmp]: '2026-04-01' }).messages.get(RMNCH.lmp)
        ).toEqual([
            {
                kind: 'error',
                text: 'LMP date entered is after the date of the antenatal care visit.',
                by: expect.objectContaining({ ruleId: 'hpO8g3CRAeC' }),
            },
        ])
    })

    it('neither assigns nor errors without an LMP', () => {
        const effects = evaluateRmnch({ [RMNCH.lmp]: null })
        expect(effects.assignedValues.has(RMNCH.gestationalAge)).toBe(false)
        expect(effects.messages.has(RMNCH.lmp)).toBe(false)
    })

    it('reports the hidden postpartum stage and the display texts', () => {
        const effects = evaluateRmnch({ dyYdfamSY2Z: '23' })
        expect(effects.hiddenProgramStages).toEqual(
            new Set([RMNCH.postpartumStage])
        )
        expect(
            effects.programStageAttributions
                .get(RMNCH.postpartumStage)
                ?.map((by) => by.ruleName)
        ).toEqual(['Hide postpartum followup'])
        expect(effects.keyValuePairs).toContainEqual({
            location: 'feedback',
            label: '# 1. Score 1',
            value: '23%',
            by: expect.objectContaining({ actionId: 'unoQyECc6z7' }),
        })
        expect(effects.displayTexts).toContainEqual(
            expect.objectContaining({ label: 'Headers', location: 'feedback' })
        )
    })

    it('returns the same attribution objects on every evaluation', () => {
        const first = evaluateRmnch({ [RMNCH.chronic]: 'false' })
        const second = evaluateRmnch({ [RMNCH.chronic]: 'false' })
        const field = RMNCH.chronicFollowUps[0]
        expect(second.hiddenFields.get(field)?.[0]).toBe(
            first.hiddenFields.get(field)?.[0]
        )
    })
})

describe('evaluateEventRules on a synthetic program', () => {
    const always = (
        id: string,
        type: string,
        extra: Record<string, string> = {}
    ) => rule(id, 'true', [{ id: `${id}_action`, type, ...extra }])

    it('normalises every client-side action type', () => {
        const effects = evaluate(
            programMetadata({
                rules: [
                    always('section', 'HIDESECTION', { sectionId: 's1' }),
                    always('mandatory', 'SETMANDATORYFIELD', {
                        dataElementId: 'm',
                    }),
                    always('warning', 'WARNINGONCOMPLETE', {
                        dataElementId: 'w',
                        content: 'Check',
                    }),
                    always('error', 'ERRORONCOMPLETE', {
                        content: 'Whole form',
                    }),
                    always('warn', 'SHOWWARNING', {
                        dataElementId: 'w',
                        displayContent: 'Low',
                        content: 'raw',
                        data: "'value'",
                    }),
                    always('message', 'SENDMESSAGE', { content: 'ignored' }),
                    always('display', 'DISPLAYTEXT', {
                        location: 'indicators',
                        content: 'Note',
                    }),
                    rule('options', 'true', [
                        {
                            id: 'hideOption',
                            type: 'HIDEOPTION',
                            dataElementId: 'o',
                            option: { id: 'opt1', code: 'A' },
                        },
                        {
                            id: 'hideGroup',
                            type: 'HIDEOPTIONGROUP',
                            dataElementId: 'o',
                            optionGroup: { id: 'g1', optionCodes: ['B'] },
                        },
                        {
                            id: 'showGroup',
                            type: 'SHOWOPTIONGROUP',
                            dataElementId: 'o',
                            optionGroup: { id: 'g2', optionCodes: ['C'] },
                        },
                    ]),
                ],
            })
        )
        expect([...effects.hiddenSections.keys()]).toEqual(['s1'])
        expect([...effects.mandatoryFields.keys()]).toEqual(['m'])
        expect(
            effects.messages.get('w')?.map(({ kind, text }) => ({ kind, text }))
        ).toEqual([
            { kind: 'warningOnComplete', text: 'Check' },
            { kind: 'warning', text: 'Low value' },
        ])
        expect(
            effects.messages
                .get('form')
                ?.map(({ kind, text }) => ({ kind, text }))
        ).toEqual([{ kind: 'errorOnComplete', text: 'Whole form' }])
        expect(effects.displayTexts).toEqual([
            expect.objectContaining({
                location: 'indicators',
                label: 'Note',
                value: '',
            }),
        ])
        expect(effects.hiddenOptions).toEqual(new Map([['o', new Set(['A'])]]))
        expect(effects.optionGroups).toEqual(
            new Map([
                ['o', { hidden: new Set(['g1']), shown: new Set(['g2']) }],
            ])
        )
        expect(effects.keyValuePairs).toEqual([])
        expect(
            effects.optionAttributions.get('o')?.map((by) => by.actionId)
        ).toEqual(['hideOption', 'hideGroup', 'showGroup'])
    })

    it('keeps evaluating the other rules when one reads an unknown variable', () => {
        const effects = evaluate(
            programMetadata({
                rules: [
                    rule('broken', '#{nope} > 1', [
                        { id: 'a', type: 'HIDEFIELD', dataElementId: 'y' },
                    ]),
                    rule('working', 'true', [
                        { id: 'b', type: 'HIDEFIELD', dataElementId: 'x' },
                    ]),
                ],
            })
        )
        expect([...effects.hiddenFields.keys()]).toEqual(['x'])
    })

    it('lets a later ASSIGN to the same field win', () => {
        const effects = evaluate(
            programMetadata({
                rules: [
                    rule(
                        'first',
                        'true',
                        [
                            {
                                id: 'a',
                                type: 'ASSIGN',
                                dataElementId: 'x',
                                data: "'1'",
                            },
                        ],
                        { priority: 1 }
                    ),
                    rule(
                        'second',
                        'true',
                        [
                            {
                                id: 'b',
                                type: 'ASSIGN',
                                dataElementId: 'x',
                                data: "'2'",
                            },
                        ],
                        { priority: 2 }
                    ),
                ],
            })
        )
        expect(effects.assignedValues.get('x')).toEqual({
            value: '2',
            by: expect.objectContaining({ actionId: 'b' }),
        })
    })

    it('reports an empty ASSIGN result as null', () => {
        const effects = evaluate(
            programMetadata({
                variables: [currentEventVariable('a', 'a')],
                rules: [
                    rule('r', 'true', [
                        {
                            id: 'x',
                            type: 'ASSIGN',
                            dataElementId: 'x',
                            data: '#{a}',
                        },
                    ]),
                ],
            })
        )
        expect(effects.assignedValues.get('x')?.value).toBeNull()
    })
})

describe('explainField', () => {
    it('lists each rule action that touched a field once', () => {
        const effects = evaluate(
            programMetadata({
                rules: [
                    rule('r', 'true', [
                        { id: 'hide', type: 'HIDEFIELD', dataElementId: 'x' },
                        {
                            id: 'warn',
                            type: 'SHOWWARNING',
                            dataElementId: 'x',
                            content: 'w',
                        },
                        {
                            id: 'assign',
                            type: 'ASSIGN',
                            dataElementId: 'x',
                            data: "'v'",
                        },
                        { id: 'other', type: 'HIDEFIELD', dataElementId: 'y' },
                    ]),
                    rule('m', 'true', [
                        {
                            id: 'mandatory',
                            type: 'SETMANDATORYFIELD',
                            dataElementId: 'x',
                        },
                        {
                            id: 'option',
                            type: 'HIDEOPTION',
                            dataElementId: 'x',
                            option: { id: 'o1', code: 'A' },
                        },
                    ]),
                ],
            })
        )
        expect(explainField(effects, 'x').map((by) => by.actionId)).toEqual([
            'hide',
            'mandatory',
            'assign',
            'warn',
            'option',
        ])
        expect(explainField(effects, 'z')).toEqual([])
    })
})
