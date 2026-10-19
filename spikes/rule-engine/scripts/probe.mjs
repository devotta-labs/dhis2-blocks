import * as E from '@dhis2/rule-engine'
const { RuleEngineJs, RuleEngineContextJs, RuleJs, RuleActionJs, RuleVariableJs, RuleVariableType, RuleValueType,
  RuleSupplementaryDataJs, RuleEventJs, RuleEventStatus, RuleLocalDate, RuleInstant, RuleDataValue } = E

const v = (name, de, t = RuleValueType.NUMERIC) =>
  new RuleVariableJs(RuleVariableType.DATAELEMENT_CURRENT_EVENT, name, true, [], de, t, null)
const act = (type, data, values, prio) => new RuleActionJs(data, type, new Map(Object.entries(values)), prio ?? null)
const ev = (dvs) => new RuleEventJs('ev1', 'st1', 'Stage', RuleEventStatus.ACTIVE, RuleLocalDate.parse('2024-01-10'),
  RuleInstant.now(), null, null, null, 'ou1', null, Object.entries(dvs).map(([k, x]) => new RuleDataValue(k, x)))
const dump = (effs) => effs.map(e => ({ rule: e.ruleId, type: e.ruleAction.type, values: Object.fromEntries(e.ruleAction.values), data: e.data, prio: e.ruleAction.priority }))
const sup = new RuleSupplementaryDataJs([], [], new Map())

// ASSIGN chain a -> b -> c, rules declared in reverse order, with priorities
const rules = [
  new RuleJs('true', [act('ASSIGN', '#{b} + 1', { field: 'deC', id: 'actC', attributeType: 'DATA_ELEMENT' })], 'ruleC', 'C', null, 3),
  new RuleJs('true', [act('ASSIGN', '#{a} + 1', { field: 'deB', id: 'actB', attributeType: 'DATA_ELEMENT' })], 'ruleB', 'B', null, 2),
  new RuleJs('#{a} > 0', [act('SHOWERROR', 'd2:round(#{a})', { field: 'deA', content: 'A positive', id: 'actE' })], 'ruleE', 'E', null, 1),
  new RuleJs('#{c} > 2', [act('HIDEFIELD', null, { field: 'deX', id: 'actH' })], 'ruleH', 'H', null, null),
]
const vars = [v('a', 'deA'), v('b', 'deB'), v('c', 'deC')]
const ctx = new RuleEngineContextJs(rules, vars, sup, new Map([['constId', '42']]))
const eng = new RuleEngineJs(false)
console.log('chain, declared reverse, priority C3 B2 E1:', JSON.stringify(dump(eng.evaluateEvent(ev({ deA: '1' }), null, [], ctx)), null, 0))
// same without priorities
const rules2 = rules.map(r => new RuleJs(r.condition, r.actions, r.uid, r.name, null, null))
console.log('chain, no priority:', JSON.stringify(dump(eng.evaluateEvent(ev({ deA: '1' }), null, [], new RuleEngineContextJs(rules2, vars, sup, new Map())))))
// priority sorted ascending
const rules3 = [rules[2], rules[1], rules[0], rules[3]].map((r, i) => new RuleJs(r.condition, r.actions, r.uid, r.name, null, i + 1))
console.log('chain, priority B before C:', JSON.stringify(dump(eng.evaluateEvent(ev({ deA: '1' }), null, [], new RuleEngineContextJs(rules3, vars, sup, new Map())))))
// reuse: same engine, different input
console.log('reuse a=5:', JSON.stringify(dump(eng.evaluateEvent(ev({ deA: '5' }), null, [], ctx))))
// constants
const cr = [new RuleJs('C{constId} == 42', [act('DISPLAYTEXT', 'C{constId}', { content: 'const', location: 'feedback' })], 'ruleK', 'K')]
console.log('constant by id:', JSON.stringify(dump(eng.evaluateEvent(ev({}), null, [], new RuleEngineContextJs(cr, [], sup, new Map([['constId', '42']]))))))
// bad expressions
const bad = [
  new RuleJs('#{a} >>> 1', [act('SHOWWARNING', null, { field: 'deA', content: 'bad cond' })], 'badCond'),
  new RuleJs('true', [act('ASSIGN', 'd2:nope(#{a})', { field: 'deB' })], 'badAction'),
  new RuleJs('#{missing} == 1', [act('SHOWWARNING', null, { content: 'missing var' })], 'missingVar'),
  new RuleJs('true', [act('SHOWWARNING', null, { content: 'good' })], 'good'),
]
try { console.log('bad exprs:', JSON.stringify(dump(eng.evaluateEvent(ev({ deA: '1' }), null, [], new RuleEngineContextJs(bad, vars, sup, new Map()))))) } catch (e) { console.log('THREW', e.message) }
const verbose = new RuleEngineJs(true)
try { verbose.evaluateEvent(ev({ deA: '1' }), null, [], new RuleEngineContextJs(bad, vars, sup, new Map())) } catch (e) { console.log('verbose THREW', e.message) }
console.log('validate:', JSON.stringify(eng.validate('#{a} >>> 1', new Map())), eng.validate('#{a} > 1', new Map([['a', new E.DataItemJs('A', E.ItemValueType.NUMBER)]])).valid)
console.log('requirements:', JSON.stringify(eng.analyzeContextRequirements(rules, vars)))
