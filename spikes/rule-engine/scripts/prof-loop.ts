import * as E from '@dhis2/rule-engine'
import { large } from '../src/large'
import { buildContext, buildInput } from '../src/adapter'
const eng = new E.RuleEngineJs(false)
const ctx = buildContext(E, large.fx)
const inp = buildInput(E, large.fx, large.events[0], large.enrollment, large.events)
for (let i = 0; i < 150; i++) eng.evaluateEvent(inp.event, inp.enrollment, inp.otherEvents, ctx)
