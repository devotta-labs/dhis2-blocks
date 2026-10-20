import { loadRuleEngine } from '@/registry/program-rules/hooks/loadRuleEngine'
import {
    buildRuleContext,
    type ProgramRuleMetadata,
    type ProgramRulesMetadata,
} from '@/registry/program-rules/index'
import {
    buildRulesGraphModel,
    checkLoops,
    connectedChain,
    fieldNodeId,
    ruleNodeId,
    type RulesGraphModel,
} from './graphModel'

const dataElementVariable = (name: string, dataElementId: string) => ({
    id: `v-${name}`,
    name,
    sourceType: 'DATAELEMENT_CURRENT_EVENT',
    useCodeForOptionSet: false,
    dataElementId,
})

const rule = (
    id: string,
    condition: string,
    actions: ProgramRuleMetadata['actions'],
    priority?: number
): ProgramRuleMetadata => ({
    id,
    name: `Rule ${id}`,
    condition,
    priority,
    actions,
})

const metadata: ProgramRulesMetadata = {
    programId: 'program',
    programName: 'Program',
    programStages: [
        { id: 'stage', name: 'Visit' },
        { id: 'postpartum', name: 'Postpartum' },
    ],
    rules: [
        rule('hideFollowUps', '!#{chronic}', [
            { id: 'a1', type: 'HIDEFIELD', dataElementId: 'followUp' },
            { id: 'a2', type: 'HIDEFIELD', dataElementId: 'otherFollowUp' },
        ]),
        rule('hideOther', '!#{followup}', [
            { id: 'a3', type: 'HIDEFIELD', dataElementId: 'otherDetails' },
        ]),
        rule('warnRisk', '#{risk}', [
            {
                id: 'a4',
                type: 'SHOWWARNING',
                dataElementId: 'lmp',
                content: 'Check LMP',
            },
            { id: 'a5', type: 'DISPLAYTEXT', content: 'High risk' },
        ]),
        rule('hideStage', '#{risk}', [
            {
                id: 'a6',
                type: 'HIDEPROGRAMSTAGE',
                programStageId: 'postpartum',
            },
        ]),
        rule('checkLmp', '#{lmp} > V{event_date}', [
            {
                id: 'a9',
                type: 'SHOWERROR',
                dataElementId: 'lmp',
                content: 'LMP is after the visit',
            },
        ]),
        rule(
            'assignRisk',
            'd2:hasValue(#{ga})',
            [
                {
                    id: 'a7',
                    type: 'ASSIGN',
                    content: '#{risk}',
                    data: '#{ga} > 30',
                },
            ],
            2
        ),
        rule(
            'gestationalAge',
            "d2:hasValue('lmp')",
            [
                {
                    id: 'a8',
                    type: 'ASSIGN',
                    dataElementId: 'ga',
                    data: 'd2:weeksBetween(#{lmp}, V{event_date})',
                },
            ],
            1
        ),
    ],
    variables: [
        dataElementVariable('lmp', 'lmp'),
        dataElementVariable('ga', 'ga'),
        dataElementVariable('chronic', 'chronic'),
        dataElementVariable('followup', 'followUp'),
        {
            id: 'v-risk',
            name: 'risk',
            sourceType: 'CALCULATED_VALUE',
            useCodeForOptionSet: false,
            valueType: 'BOOLEAN',
        },
    ],
    constants: [],
    optionSets: [],
    user: { roleIds: [], groupIds: [] },
}

const labels = {
    fields: new Map([
        ['lmp', 'Last menstrual period'],
        ['ga', 'Gestational age'],
    ]),
    sections: new Map<string, string>(),
}

const build = async (): Promise<RulesGraphModel> => {
    const context = buildRuleContext(await loadRuleEngine(), metadata)
    return buildRulesGraphModel(context, metadata, labels)
}

const edge = (model: RulesGraphModel, source: string, target: string) =>
    model.edges.find((e) => e.source === source && e.target === target)

describe('buildRulesGraphModel', () => {
    it('lists rules in evaluation order with their own effects', async () => {
        const model = await build()
        const rules = model.nodes.flatMap((node) =>
            node.kind === 'rule' ? [[node.ruleId, node.order]] : []
        )
        expect(rules).toEqual([
            ['gestationalAge', 1],
            ['assignRisk', 2],
            ['hideFollowUps', 3],
            ['hideOther', 4],
            ['warnRisk', 5],
            ['hideStage', 6],
            ['checkLmp', 7],
        ])
        expect(
            model.nodes.find((node) => node.id === ruleNodeId('warnRisk'))
        ).toMatchObject({ effects: ['DISPLAYTEXT'] })
    })

    it('draws an ASSIGN chain through fields and calculated variables', async () => {
        const model = await build()
        expect(
            edge(model, fieldNodeId('lmp'), ruleNodeId('gestationalAge'))?.kind
        ).toBe('read')
        expect(
            edge(model, ruleNodeId('gestationalAge'), fieldNodeId('ga'))
                ?.actionTypes
        ).toEqual(['ASSIGN'])
        expect(
            edge(model, fieldNodeId('ga'), ruleNodeId('assignRisk'))
        ).toBeDefined()
        expect(
            edge(model, ruleNodeId('assignRisk'), 'variable:risk')?.actionTypes
        ).toEqual(['ASSIGN'])
        expect(
            edge(model, 'variable:risk', ruleNodeId('warnRisk'))
        ).toBeDefined()
        expect(
            edge(model, ruleNodeId('hideStage'), 'stage:postpartum')
        ).toBeDefined()
        // Reads are direct: the transitive lmp → warnRisk is not an edge.
        expect(edge(model, fieldNodeId('lmp'), ruleNodeId('warnRisk'))).toBe(
            undefined
        )
    })

    it('labels fields by name, then by variable, then by id', async () => {
        const model = await build()
        const label = (fieldId: string) => {
            const node = model.nodes.find((n) => n.id === fieldNodeId(fieldId))
            return node?.kind === 'field' ? node.label : undefined
        }
        expect(label('ga')).toBe('Gestational age')
        expect(label('chronic')).toBe('chronic')
        expect(label('otherDetails')).toBe('otherDetails')
        expect(
            model.nodes.find((n) => n.id === 'stage:postpartum')
        ).toMatchObject({ label: 'Postpartum' })
    })
})

describe('connectedChain', () => {
    it('follows a hide chain downstream', async () => {
        const chain = connectedChain(await build(), fieldNodeId('chronic'))
        expect([...chain.nodes].sort()).toEqual(
            [
                fieldNodeId('chronic'),
                ruleNodeId('hideFollowUps'),
                fieldNodeId('followUp'),
                fieldNodeId('otherFollowUp'),
                ruleNodeId('hideOther'),
                fieldNodeId('otherDetails'),
            ].sort()
        )
    })

    it('treats a message as an end, not a cause', async () => {
        const model = await build()
        const fromRule = connectedChain(model, ruleNodeId('gestationalAge'))
        // Downstream, the chain ends at the warning on lmp.
        expect(fromRule.nodes.has(ruleNodeId('warnRisk'))).toBe(true)
        expect(fromRule.nodes.has(fieldNodeId('lmp'))).toBe(true)
        // Upstream, the rule that only shows an error on lmp is no cause.
        expect(fromRule.nodes.has(ruleNodeId('checkLmp'))).toBe(false)
        // As a direct neighbour of lmp it is shown.
        const fromLmp = connectedChain(model, fieldNodeId('lmp'))
        expect(fromLmp.nodes.has(ruleNodeId('checkLmp'))).toBe(true)
    })
})

describe('checkLoops', () => {
    it('folds a message on a field the rule reads into its read edge', async () => {
        const loops = checkLoops(await build())
        const read = `read:${fieldNodeId('lmp')}->${ruleNodeId('checkLmp')}`
        expect([...loops.keys()]).toEqual([read])
        expect(loops.get(read)?.actionTypes).toEqual(['SHOWERROR'])
    })
})
