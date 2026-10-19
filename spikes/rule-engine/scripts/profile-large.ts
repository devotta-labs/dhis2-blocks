import * as E from '@dhis2/rule-engine'
import { large } from '../src/large'
import { buildContext, buildInput, toEffects } from '../src/adapter'
import { benchSubset } from '../src/bench'
const ids = large.fx.programRules.map((r) => r.id)
for (const n of [1, 10, 30, 100, 300]) console.log('subset', n, JSON.stringify(benchSubset(E, large, new Set(ids.slice(0, n)), 50)))
// same rules, no other events / fewer variables
const noOthers = { ...large, events: [large.events[0]] }
console.log('300 rules, 0 other events', JSON.stringify(benchSubset(E, noOthers, new Set(ids), 50)))
const fewVars = { ...large, fx: { ...large.fx, programRuleVariables: large.fx.programRuleVariables } }
// parse cost alone
const exprs = large.fx.programRules.flatMap((r) => [r.condition!, ...r.programRuleActions.map((a) => a.data).filter(Boolean) as string[]])
for (let i = 0; i < 5; i++) exprs.forEach((x) => new E.ExpressionJs(x, E.ExpressionMode.RULE_ENGINE_CONDITION))
let t = performance.now()
for (let i = 0; i < 20; i++) exprs.forEach((x) => new E.ExpressionJs(x, E.ExpressionMode.RULE_ENGINE_CONDITION))
console.log('parse', exprs.length, 'expressions, ms/round', ((performance.now() - t) / 20).toFixed(2))
const eng = new E.RuleEngineJs(false)
const ctx = buildContext(E, large.fx)
const inp = buildInput(E, large.fx, large.events[0], large.enrollment, large.events)
const fx = toEffects(eng.evaluateEvent(inp.event, inp.enrollment, inp.otherEvents, ctx))
console.log('chain 0', fx.filter((e) => ['de000000100', 'de000000101', 'de000000102'].includes(e.values.field)).map((e) => `${e.values.field}=${e.data}`))
const v = Object.fromEntries(large.events[0].dataValues.map((d) => [d.dataElement, d.value]))
console.log('inputs v0, v11', v.de000000000, v.de000000011)
