import * as E from '@dhis2/rule-engine'
import { large } from '../src/large'
import { buildContext, buildInput, toEffects } from '../src/adapter'
const eng = new E.RuleEngineJs(false)
const inp = buildInput(E, large.fx, large.events[0], large.enrollment, large.events)
const fx = toEffects(eng.evaluateEvent(inp.event, inp.enrollment, inp.otherEvents, buildContext(E, large.fx)))
const v = Object.fromEntries(large.events[0].dataValues.map((d) => [d.dataElement, d.value]))
const got = ['de000000100', 'de000000101', 'de000000102'].map((f) => fx.find((e) => e.values.field === f)?.data)
const a = +v.de000000000 + +v.de000000011, b = a * 2, c = Math.round(b / 3) + 70
console.log({ inputs: [v.de000000000, v.de000000011], expected: [a, b, c].map(String), got })
