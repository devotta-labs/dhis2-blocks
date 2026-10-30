import * as engine from '@dhis2/rule-engine'
import {
    currentEventVariable,
    programMetadata,
    rule,
} from '../__tests__/metadata'
import { RMNCH, rmnchMetadata } from '../__tests__/rmnch'
import { buildRuleContext } from './buildContext'
import type { RuleDependencies } from './types'

const rmnchRule = (name: string): RuleDependencies => {
    const context = buildRuleContext(engine, rmnchMetadata())
    const info = [...context.ruleInfo.values()].find((candidate) =>
        candidate.name.startsWith(name)
    )
    const dependencies = info && context.graph.rules.get(info.id)
    if (dependencies === undefined) {
        throw new Error(`no RMNCH rule named ${name}`)
    }
    return dependencies
}

describe('the dependency graph', () => {
    it('records what the chronic conditions rule reads and writes', () => {
        const chronic = rmnchRule('Hide all fields for chronic')
        expect(chronic.readsVariables).toEqual(['chronicconditions'])
        expect(chronic.readsFields).toEqual([RMNCH.chronic])
        expect([...chronic.writesFields].sort()).toEqual(
            [...RMNCH.chronicFollowUps].sort()
        )
    })

    it('records program variables and assigned fields', () => {
        const gestationalAge = rmnchRule('Calculate gestational age')
        expect(gestationalAge.readsFields).toEqual([RMNCH.lmp])
        expect(gestationalAge.readsProgramVariables).toEqual(['event_date'])
        expect(gestationalAge.writesFields).toEqual([RMNCH.gestationalAge])
    })

    it('indexes readers and writers by field', () => {
        const context = buildRuleContext(engine, rmnchMetadata())
        const chronicId = [...context.ruleInfo.values()].find((info) =>
            info.name.startsWith('Hide all fields for chronic')
        )?.id
        expect(context.graph.fieldReaders.get(RMNCH.chronic)).toEqual([
            chronicId,
        ])
        expect(context.graph.fieldWriters.get(RMNCH.gestationalAge)).toEqual([
            'KRMEVVbex0q',
        ])
    })

    const chain = (consumerPriority: number) =>
        buildRuleContext(
            engine,
            programMetadata({
                variables: [
                    currentEventVariable('lmp', 'lmpField', {
                        fieldValueType: 'DATE',
                    }),
                    {
                        id: 'var_calc',
                        name: 'calc',
                        sourceType: 'CALCULATED_VALUE',
                        useCodeForOptionSet: false,
                        valueType: 'NUMBER',
                    },
                ],
                rules: [
                    rule(
                        'producer',
                        "d2:hasValue('lmp')",
                        [
                            {
                                id: 'assign',
                                type: 'ASSIGN',
                                content: '#{calc}',
                                data: 'd2:daysBetween(#{lmp}, V{event_date})',
                            },
                        ],
                        { priority: 1 }
                    ),
                    rule(
                        'consumer',
                        '#{calc} > 10',
                        [{ id: 'hide', type: 'HIDEFIELD', dataElementId: 'x' }],
                        { priority: consumerPriority }
                    ),
                ],
            })
        )

    it('follows ASSIGN chains into the rules evaluated after them', () => {
        const context = chain(2)
        expect(context.graph.rules.get('consumer')?.readsFields).toEqual([
            'lmpField',
        ])
        expect(context.graph.rules.get('producer')?.writesVariables).toEqual([
            'calc',
        ])
        expect(context.ruleInfo.get('consumer')?.actions.get('hide')).toEqual({
            ruleId: 'consumer',
            ruleName: 'rule consumer',
            actionId: 'hide',
            condition: '#{calc} > 10',
            readsFields: ['lmpField'],
        })
    })

    it('does not follow a chain into rules evaluated before it', () => {
        const context = chain(0)
        expect(context.graph.rules.get('consumer')?.readsFields).toEqual([])
        expect([...context.graph.rules.keys()]).toEqual([
            'consumer',
            'producer',
        ])
    })
})
