import * as E0 from '@dhis2/rule-engine'
import * as P from '../node_modules/@dhis2/rule-engine/expression-parser.mjs'
const E = { ...E0, ...P } as any
import { rmnch } from '../src/rmnch'
import { buildContext } from '../src/adapter'
for (const r of rmnch.fx.programRules) {
    const deps = (x: string | undefined, mode: any) => {
        if (!x) return '-'
        try {
            const e = new E.ExpressionJs(x, mode)
            return `vars=[${e.collectProgramRuleVariableNames()}] pv=[${e.collectProgramVariablesNames()}] ougroups=[${e.collectInOrgUnitGroups()}]`
        } catch (err: any) { return 'PARSE ERROR ' + err.message.split('\n')[0] }
    }
    console.log(r.name.slice(0, 40).padEnd(40), 'cond:', deps(r.condition, E.ExpressionMode.RULE_ENGINE_CONDITION))
    for (const a of r.programRuleActions) if (a.data) console.log(''.padEnd(40), ' act:', deps(a.data, E.ExpressionMode.RULE_ENGINE_ACTION))
}
const eng = new E0.RuleEngineJs(false)
const ctx = buildContext(E, rmnch.fx)
console.log('requirements', JSON.stringify(eng.analyzeContextRequirements(ctx.rules, ctx.ruleVariables)))
const D = (n: string, t: any) => new E0.DataItemJs(n, t)
const store = new Map(rmnch.fx.programRuleVariables.map((v) => [v.name, D(v.name, E0.ItemValueType.TEXT)]))
for (const r of rmnch.fx.programRules.slice(0, 18)) { const res = eng.validate(r.condition!, store); if (!res.valid) console.log('validate', r.name, '->', res.errorMessage?.split('\n')[0]) }
