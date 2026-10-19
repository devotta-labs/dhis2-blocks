import type * as Engine from '@dhis2/rule-engine'
import { buildContext, buildInput, toEffects, type Effect, type RawEvent } from './adapter'
import type { Bundle } from './fixtures'

type Mod = typeof Engine
const now = () => performance.now()
const stats = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
    return { median: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), min: +s[0].toFixed(3), max: +s[s.length - 1].toFixed(3), n: s.length }
}

export function withValues(ev: RawEvent, values: Record<string, string | null>): RawEvent {
    const kept = ev.dataValues.filter((dv) => !(dv.dataElement in values))
    const added = Object.entries(values).flatMap(([dataElement, value]) => (value === null ? [] : [{ dataElement, value }]))
    return { ...ev, dataValues: [...kept, ...added] }
}

export function evaluate(E: Mod, engine: Engine.RuleEngineJs, ctx: Engine.RuleEngineContextJs, b: Bundle, current: RawEvent): Effect[] {
    const input = buildInput(E, b.fx, current, b.enrollment, b.events)
    return toEffects(engine.evaluateEvent(input.event, input.enrollment, input.otherEvents, ctx))
}

export function bench(E: Mod, b: Bundle, runs = 100, warmup = 5) {
    const current = b.events.find((e) => e.event === b.currentEventId)!
    let t = now()
    const engine = new E.RuleEngineJs(false)
    const ctx = buildContext(E, b.fx)
    const contextMs = now() - t

    t = now()
    const first = evaluate(E, engine, ctx, b, current)
    const firstEvalMs = now() - t

    const input = buildInput(E, b.fx, current, b.enrollment, b.events)
    for (let i = 0; i < warmup; i++) engine.evaluateEvent(input.event, input.enrollment, input.otherEvents, ctx)
    const evalOnly: number[] = []
    for (let i = 0; i < runs; i++) {
        t = now()
        engine.evaluateEvent(input.event, input.enrollment, input.otherEvents, ctx)
        evalOnly.push(now() - t)
    }
    // the realistic per-keystroke cost: fresh input mapping + evaluation
    const withInput: number[] = []
    for (let i = 0; i < runs; i++) {
        t = now()
        evaluate(E, engine, ctx, b, current)
        withInput.push(now() - t)
    }
    // context rebuilt every time (what Capture does) for comparison
    const rebuildAll: number[] = []
    for (let i = 0; i < Math.min(runs, 30); i++) {
        t = now()
        evaluate(E, new E.RuleEngineJs(false), buildContext(E, b.fx), b, current)
        rebuildAll.push(now() - t)
    }
    return {
        rules: b.fx.programRules.length,
        variables: b.fx.programRuleVariables.length,
        otherEvents: b.events.length - 1,
        effects: first.length,
        contextMs: +contextMs.toFixed(3),
        firstEvalMs: +firstEvalMs.toFixed(3),
        evalOnly: stats(evalOnly),
        inputPlusEval: stats(withInput),
        rebuildEverything: stats(rebuildAll),
    }
}

/** Subset evaluation: a context holding only some rules. */
export function benchSubset(E: Mod, b: Bundle, ruleIds: Set<string>, runs = 100) {
    const current = b.events.find((e) => e.event === b.currentEventId)!
    const engine = new E.RuleEngineJs(false)
    const ctx = buildContext(E, b.fx, b.fx.programRules.filter((r) => ruleIds.has(r.id)))
    const input = buildInput(E, b.fx, current, b.enrollment, b.events)
    for (let i = 0; i < 5; i++) engine.evaluateEvent(input.event, input.enrollment, input.otherEvents, ctx)
    const xs: number[] = []
    for (let i = 0; i < runs; i++) {
        const t = now()
        engine.evaluateEvent(input.event, input.enrollment, input.otherEvents, ctx)
        xs.push(now() - t)
    }
    return { rules: ruleIds.size, ...stats(xs) }
}
