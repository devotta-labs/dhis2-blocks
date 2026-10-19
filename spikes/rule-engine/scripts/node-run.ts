// Quick Node run of the scenarios and bench (the real numbers come from Chromium).
import * as E from '@dhis2/rule-engine'
import { rmnch } from '../src/rmnch'
import { rmnchScenarios } from '../src/scenarios'
import { bench } from '../src/bench'
const { scenarios, baseEffects } = rmnchScenarios(E, rmnch)
for (const s of scenarios) console.log(s.pass ? 'PASS' : 'FAIL', s.name, s.pass ? '' : JSON.stringify(s.detail))
console.log('base effects:', baseEffects.map((e) => `${e.type}:${e.values.field ?? e.values.content ?? ''}=${e.data ?? ''}`).join(' | '))
console.log(JSON.stringify(bench(E, rmnch), null, 1))
import { large } from '../src/large'
import { buildContext, buildInput, toEffects } from '../src/adapter'
const lb = bench(E, large)
console.log('LARGE', JSON.stringify(lb, null, 1))
{
    const eng = new E.RuleEngineJs(false)
    const ctx = buildContext(E, large.fx)
    const cur = large.events[0]
    const inp = buildInput(E, large.fx, cur, large.enrollment, large.events)
    const fx = toEffects(eng.evaluateEvent(inp.event, inp.enrollment, inp.otherEvents, ctx))
    const by = (t: string) => fx.filter((e) => e.type === t).length
    console.log('large effects', { HIDEFIELD: by('HIDEFIELD'), ASSIGN: by('ASSIGN'), SHOWERROR: by('SHOWERROR') })
    console.log('chain 0', fx.filter((e) => e.type === 'ASSIGN').slice(0, 3).map((e) => `${e.values.field}=${e.data}`))
}
