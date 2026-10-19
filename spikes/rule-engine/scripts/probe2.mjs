import * as E from '@dhis2/rule-engine'
const { RuleEngineJs, RuleEngineContextJs, RuleJs, RuleActionJs, RuleVariableJs, RuleVariableType, RuleValueType,
  RuleSupplementaryDataJs, RuleEventJs, RuleEventStatus, RuleLocalDate, RuleInstant, RuleDataValue } = E
const v = (name, de, t = RuleValueType.NUMERIC) => new RuleVariableJs(RuleVariableType.DATAELEMENT_CURRENT_EVENT, name, true, [], de, t, null)
const act = (type, data, values, prio) => new RuleActionJs(data, type, new Map(Object.entries(values)), prio ?? null)
const ev = (dvs) => new RuleEventJs('ev1', 'st1', 'Stage', RuleEventStatus.ACTIVE, RuleLocalDate.parse('2024-01-10'), RuleInstant.now(), null, null, null, 'ou1', null, Object.entries(dvs).map(([k, x]) => new RuleDataValue(k, x)))
const dump = (effs) => effs.map(e => `${e.ruleId}:${e.ruleAction.type}:${JSON.stringify(Object.fromEntries(e.ruleAction.values))}=${e.data}`)
const sup = new RuleSupplementaryDataJs([], [], new Map())
const vars = [v('a', 'deA'), v('b', 'deB'), v('c', 'deC'), v('calc', '', RuleValueType.NUMERIC)]
vars[3] = new RuleVariableJs(RuleVariableType.CALCULATED_VALUE, 'calc', true, [], '', RuleValueType.NUMERIC, null)
const eng = new RuleEngineJs(false)
const run = (label, rules) => console.log(label, dump(eng.evaluateEvent(ev({ deA: '1' }), null, [], new RuleEngineContextJs(rules, vars, sup, new Map()))))
run('content-only chain:', [
  new RuleJs('true', [act('ASSIGN', '#{a} + 1', { content: '#{b}', id: 'actB' })], 'ruleB', 'B', null, 1),
  new RuleJs('true', [act('ASSIGN', '#{b} + 1', { content: '#{c}', id: 'actC' })], 'ruleC', 'C', null, 2),
])
run('content-only chain, reversed priority:', [
  new RuleJs('true', [act('ASSIGN', '#{a} + 1', { content: '#{b}', id: 'actB' })], 'ruleB', 'B', null, 2),
  new RuleJs('true', [act('ASSIGN', '#{b} + 1', { content: '#{c}', id: 'actC' })], 'ruleC', 'C', null, 1),
])
run('field+content in one action:', [
  new RuleJs('true', [act('ASSIGN', '#{a} + 1', { field: 'deB', content: '#{b}' })], 'ruleB', 'B', null, 1),
  new RuleJs('true', [act('ASSIGN', '#{b} + 1', { field: 'deC', content: '#{c}' })], 'ruleC', 'C', null, 2),
])
run('to calculated var:', [
  new RuleJs('true', [act('ASSIGN', '#{a} * 10', { content: '#{calc}' })], 'r1', 'R1', null, 1),
  new RuleJs('#{calc} > 5', [act('SHOWWARNING', '#{calc}', { content: 'calc big' })], 'r2', 'R2', null, 2),
])
const cr = [new RuleJs('C{Gfd3ppDfq8E} == 42', [act('DISPLAYTEXT', 'C{Gfd3ppDfq8E}', { content: 'const', location: 'feedback' })], 'ruleK', 'K')]
console.log('constant by uid:', dump(eng.evaluateEvent(ev({}), null, [], new RuleEngineContextJs(cr, [], sup, new Map([['Gfd3ppDfq8E', '42']])))))
// mutation check: is the context mutated by evaluation? evaluate twice with same ctx
const ctx = new RuleEngineContextJs([new RuleJs('true', [act('ASSIGN', '#{a} + 1', { content: '#{b}' })], 'x', 'X', null, 1), new RuleJs('#{b} > 0', [act('SHOWWARNING', '#{b}', { content: 'b' })], 'y', 'Y', null, 2)], vars, sup, new Map())
console.log('ctx reuse 1:', dump(eng.evaluateEvent(ev({ deA: '1' }), null, [], ctx)))
console.log('ctx reuse 2 (a empty):', dump(eng.evaluateEvent(ev({}), null, [], ctx)))
// 'subset' = new context with a filtered rule list; cost of constructing ctx
const t0 = performance.now(); for (let i = 0; i < 1000; i++) new RuleEngineContextJs(ctx.rules.slice(0, 1), vars, sup, new Map()); console.log('ctx construct x1000 ms', (performance.now() - t0).toFixed(1))
