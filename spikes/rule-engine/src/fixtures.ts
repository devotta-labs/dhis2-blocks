import type { Fixtures, RawEnrollment, RawEvent } from './adapter'

export interface Bundle {
    fx: Fixtures
    enrollment: RawEnrollment
    events: RawEvent[]
    currentEventId: string
}

// Raw API JSON → the adapter's Fixtures. Only lookups, no conversion.
export function assemble(raw: {
    programRules: any; programRuleVariables: any; constants: any; optionSets: any; orgUnit: any; me: any;
    program: any; stage: any; enrollment: any
}, currentEventId: string): Bundle {
    const valueTypes: Record<string, string> = {}
    for (const v of raw.programRuleVariables.programRuleVariables) {
        const s = v.dataElement ?? v.trackedEntityAttribute
        if (s?.valueType) valueTypes[s.id] = s.valueType
    }
    for (const p of raw.stage.programStageDataElements) valueTypes[p.dataElement.id] = p.dataElement.valueType
    for (const p of raw.program.programTrackedEntityAttributes) valueTypes[p.trackedEntityAttribute.id] = p.trackedEntityAttribute.valueType
    const fx: Fixtures = {
        programRules: raw.programRules.programRules,
        programRuleVariables: raw.programRuleVariables.programRuleVariables,
        constants: raw.constants.constants,
        optionSets: raw.optionSets.optionSets,
        orgUnit: raw.orgUnit,
        me: raw.me,
        valueTypes,
        programName: raw.program.name,
        stageNames: Object.fromEntries(raw.program.programStages.map((s: any) => [s.id, s.name])),
    }
    return { fx, enrollment: raw.enrollment, events: raw.enrollment.events, currentEventId }
}
