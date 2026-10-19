import type * as Engine from '@dhis2/rule-engine'
import { buildContext, type Effect } from './adapter'
import { evaluate, withValues } from './bench'
import type { Bundle } from './fixtures'

type Mod = typeof Engine
const CHRONIC = 'de0FEHSIoxh'
const CHRONIC_FOLLOWUPS = ['xPTngRLQTnu', 'sdchiIXIcCf', 'VFffa31SKjH', 'Q1x1HIhuwFN', 'zzGNbeMnTd6', 'UQ2Zo8CruPB']
const LMP = 'w4ky6EkVahL'
const GEST_AGE = 'roKuXYfw1BW'

const hidden = (fx: Effect[]) => fx.filter((e) => e.type === 'HIDEFIELD').map((e) => e.values.field)

export function rmnchScenarios(E: Mod, b: Bundle) {
    const engine = new E.RuleEngineJs(false)
    const ctx = buildContext(E, b.fx)
    const base = b.events.find((e) => e.event === b.currentEventId)!
    const run = (values: Record<string, string | null>) => evaluate(E, engine, ctx, b, withValues(base, values))
    const out: { name: string; pass: boolean; detail: unknown }[] = []

    const no = run({ [CHRONIC]: 'false' })
    const yes = run({ [CHRONIC]: 'true' })
    out.push({
        name: 'Chronic conditions = No hides the 6 follow-ups; = Yes shows them',
        pass: CHRONIC_FOLLOWUPS.every((f) => hidden(no).includes(f)) && CHRONIC_FOLLOWUPS.every((f) => !hidden(yes).includes(f)),
        detail: { hiddenWhenNo: hidden(no).filter((f) => CHRONIC_FOLLOWUPS.includes(f)), hiddenWhenYes: hidden(yes).filter((f) => CHRONIC_FOLLOWUPS.includes(f)) },
    })

    // event date 2026-03-12; LMP 70 days earlier → 10 weeks
    const lmp = run({ [LMP]: '2026-01-01' })
    const assign = lmp.find((e) => e.type === 'ASSIGN' && e.values.field === GEST_AGE)
    out.push({ name: 'LMP 2026-01-01 assigns gestational age 10', pass: assign?.data === '10', detail: assign })

    const late = run({ [LMP]: '2026-04-01' })
    const err = late.find((e) => e.type === 'SHOWERROR' && e.values.field === LMP)
    out.push({ name: 'LMP after visit date gives the rule error', pass: !!err, detail: err })

    const noLmp = run({ [LMP]: null })
    out.push({
        name: 'No LMP: no gestational-age assign, no LMP error',
        pass: !noLmp.some((e) => e.values.field === GEST_AGE || (e.type === 'SHOWERROR' && e.values.field === LMP)),
        detail: noLmp.filter((e) => e.values.field === GEST_AGE),
    })

    out.push({ name: 'Every effect carries rule id and action id', pass: [...no, ...lmp, ...late].every((e) => e.ruleId && e.actionId), detail: null })
    return { scenarios: out, baseEffects: run({}) }
}
