// 300 rules over 200 data elements, in raw API shapes, from the RMNCH shapes:
// 100 HIDEFIELD, 99 ASSIGN in 33 chains of depth 3, 101 SHOWERROR. 10 other events.
import { writeFileSync, mkdirSync } from 'node:fs'
import { rmnch } from '../src/rmnch'
import type { Bundle } from '../src/fixtures'
import type { RawRule, RawVariable, RawEvent } from '../src/adapter'

let seq = 0
const uid = (p: string) => `${p}${String(seq++).padStart(10 - p.length + 1, '0')}`.slice(0, 11)
const N_DE = 200
const des = Array.from({ length: N_DE }, (_, i) => `de${String(i).padStart(9, '0')}`)
const vname = (i: number) => `v${i}`
const STAGE = 'WZbXY0S00lP'
// 0..99 inputs; 100..198 assign targets; 199 a date
const valueTypes: Record<string, string> = Object.fromEntries(des.map((d, i) => [d, i === 199 ? 'DATE' : 'NUMBER']))
const variables: RawVariable[] = des.map((d, i) => ({
    id: uid('V'),
    name: vname(i),
    // inputs read the newest value across the program; targets the current event
    programRuleVariableSourceType: i < 100 ? 'DATAELEMENT_NEWEST_EVENT_PROGRAM' : 'DATAELEMENT_CURRENT_EVENT',
    useCodeForOptionSet: false,
    dataElement: { id: d, valueType: valueTypes[d] },
}))
const rules: RawRule[] = []
const act = (type: string, extra: object) => ({ id: uid('A'), programRuleActionType: type, ...extra })
for (let i = 0; i < 100; i++) {
    const a = i, b = (i * 7 + 3) % 100
    rules.push({
        id: uid('R'), name: `hide ${i}`, condition: `#{${vname(a)}} > 50 && d2:hasValue('${vname(b)}') && #{${vname(b)}} < 20`,
        programRuleActions: [act('HIDEFIELD', { dataElement: { id: des[(i + 1) % 100] } }), act('HIDEFIELD', { dataElement: { id: des[(i + 2) % 100] } })],
    })
}
for (let c = 0; c < 33; c++) {
    const t = 100 + c * 3
    const src = [c, (c + 11) % 100]
    const steps = [
        `#{${vname(src[0])}} + #{${vname(src[1])}}`,
        `#{${vname(t)}} * 2`,
        `d2:round(#{${vname(t + 1)}} / 3) + d2:daysBetween(#{${vname(199)}}, V{event_date})`,
    ]
    steps.forEach((data, k) =>
        rules.push({
            id: uid('R'), name: `chain ${c}.${k}`, condition: k === 0 ? `d2:hasValue('${vname(src[0])}')` : `d2:hasValue('${vname(t + k - 1)}')`,
            priority: k + 1,
            programRuleActions: [act('ASSIGN', { content: `#{${vname(t + k)}}`, data })],
        }),
    )
}
for (let i = 0; rules.length < 300; i++) {
    const a = (i * 13) % 100, b = (i * 17 + 5) % 100
    rules.push({
        id: uid('R'), name: `error ${i}`, condition: `d2:hasValue('${vname(a)}') && #{${vname(a)}} > #{${vname(b)}} + 10 || d2:validatePattern('${i}', '[0-9]+') && false`,
        programStage: i % 2 ? { id: STAGE } : undefined,
        programRuleActions: [act('SHOWERROR', { dataElement: { id: des[a] }, content: `${vname(a)} too large`, data: `#{${vname(a)}} - #{${vname(b)}}` })],
    })
}
const rnd = (() => { let s = 42; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) })()
const mkEvent = (n: number, stage: string, date: string, k: number): RawEvent => ({
    event: `ev${String(n).padStart(9, '0')}`, programStage: stage, status: 'ACTIVE', occurredAt: `${date}T12:00:00.000`,
    createdAt: `${date}T12:00:00.000`, orgUnit: rmnch.fx.orgUnit.id,
    dataValues: [
        ...des.slice(0, 100).filter(() => rnd() < k).map((d) => ({ dataElement: d, value: String(Math.floor(rnd() * 100)) })),
        { dataElement: des[199], value: '2026-01-01' },
    ],
})
const current = mkEvent(0, STAGE, '2026-03-12', 1)
const others = Array.from({ length: 10 }, (_, i) => mkEvent(i + 1, i % 2 ? 'edqlbukwRfQ' : 'bbKtnxRZKEP', `2026-0${(i % 9) + 1}-15`, 0.5))
const bundle: Bundle = {
    fx: { ...rmnch.fx, programRules: rules, programRuleVariables: variables, optionSets: [], valueTypes },
    enrollment: rmnch.enrollment,
    events: [current, ...others],
    currentEventId: current.event,
}
mkdirSync('fixtures/large', { recursive: true })
writeFileSync('fixtures/large/bundle.json', JSON.stringify(bundle))
console.log({ rules: rules.length, variables: variables.length, events: bundle.events.length, currentValues: current.dataValues.length })
