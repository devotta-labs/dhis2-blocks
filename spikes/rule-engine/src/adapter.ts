// Maps raw DHIS2 API JSON to @dhis2/rule-engine inputs. The engine module is
// passed in so this file never pulls the engine into the initial chunk.
import type * as Engine from '@dhis2/rule-engine'

type Ref = { id: string } | undefined
type Mod = typeof Engine

export interface RawAction {
    id: string
    programRuleActionType: string
    content?: string
    data?: string
    location?: string
    dataElement?: Ref
    trackedEntityAttribute?: Ref
    programStageSection?: Ref
    programStage?: Ref
    option?: Ref
    optionGroup?: Ref
}
export interface RawRule {
    id: string
    name: string
    condition?: string
    priority?: number
    programStage?: Ref
    programRuleActions: RawAction[]
}
export interface RawVariable {
    id: string
    name: string
    programRuleVariableSourceType: string
    useCodeForOptionSet?: boolean
    valueType?: string
    dataElement?: { id: string; valueType?: string; optionSet?: Ref }
    trackedEntityAttribute?: { id: string; valueType?: string; optionSet?: Ref }
    programStage?: Ref
}
export interface RawOptionSet {
    id: string
    options: { code: string; name: string; displayName?: string }[]
}
export interface Fixtures {
    programRules: RawRule[]
    programRuleVariables: RawVariable[]
    constants: { id: string; value: number | string }[]
    optionSets: RawOptionSet[]
    orgUnit: { id: string; code?: string; organisationUnitGroups: { id: string; code?: string }[] }
    me: { userRoles: Ref[]; userGroups: Ref[] }
    /** valueType by data element / attribute id, for value normalisation */
    valueTypes: Record<string, string>
    programName: string
    stageNames: Record<string, string>
}
export interface RawEvent {
    event: string
    programStage: string
    status: string
    occurredAt?: string
    scheduledAt?: string
    completedAt?: string
    createdAt?: string
    createdAtClient?: string
    orgUnit: string
    dataValues: { dataElement: string; value: string }[]
}
export interface RawEnrollment {
    enrollment: string
    status: string
    enrolledAt: string
    occurredAt?: string
    orgUnit: string
    attributes: { attribute: string; value: string }[]
}

const NUMERIC = new Set([
    'NUMBER', 'INTEGER', 'INTEGER_POSITIVE', 'INTEGER_NEGATIVE', 'INTEGER_ZERO_OR_POSITIVE', 'PERCENTAGE', 'UNIT_INTERVAL',
])
const BOOLEAN = new Set(['BOOLEAN', 'TRUE_ONLY'])
const DATE = new Set(['DATE', 'DATETIME', 'AGE'])

const ruleValueType = (E: Mod, vt?: string) =>
    vt && NUMERIC.has(vt) ? E.RuleValueType.NUMERIC
    : vt && BOOLEAN.has(vt) ? E.RuleValueType.BOOLEAN
    : vt && DATE.has(vt) ? E.RuleValueType.DATE
    : E.RuleValueType.TEXT

// Tracker API timestamps carry no offset ("2026-03-12T12:05:00.000"); the
// engine wants yyyy-MM-dd for dates and an offset for instants.
const localDate = (E: Mod, s?: string) => (s ? E.RuleLocalDate.parse(s.slice(0, 10)) : null)
const instant = (E: Mod, s?: string) => (s ? E.RuleInstant.parse(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`) : null)

/** Normalise a raw stored value to what the engine parses. Empty → dropped. */
export const normaliseValue = (value: string | undefined | null, valueType?: string): string | null => {
    if (value === undefined || value === null || value === '') return null
    if (valueType === 'DATETIME' || valueType === 'AGE') return value.slice(0, 10)
    return value
}

const ASSIGN_VAR = /^[#A]\{([^{}]+)\}$/

export function buildActions(E: Mod, rule: RawRule, variablesByName: Map<string, RawVariable>): Engine.RuleActionJs[] {
    const out: Engine.RuleActionJs[] = []
    for (const a of rule.programRuleActions) {
        const field = a.dataElement?.id ?? a.trackedEntityAttribute?.id
        const attributeType = a.dataElement ? 'DATA_ELEMENT' : a.trackedEntityAttribute ? 'TRACKED_ENTITY_ATTRIBUTE' : 'UNKNOWN'
        const base: [string, string][] = [['id', a.id], ['ruleId', rule.id]]
        const opt = (k: string, v?: string) => (v ? [[k, v] as [string, string]] : [])
        if (a.programRuleActionType === 'ASSIGN') {
            // field-targeted ASSIGN writes valueMap[fieldUid], invisible to #{var}
            // reads; content-targeted ASSIGN writes the variable and the engine
            // re-targets the effect to the variable's backing field. Emit the
            // content form when it names a variable, and the field form only
            // when it targets something else.
            const varName = a.content?.match(ASSIGN_VAR)?.[1]
            const backing = varName ? variablesByName.get(varName) : undefined
            const backingField = backing?.dataElement?.id ?? backing?.trackedEntityAttribute?.id
            if (varName) out.push(new E.RuleActionJs(a.data ?? null, 'ASSIGN', new Map([...base, ['content', a.content!]]), null))
            if (field && field !== backingField)
                out.push(new E.RuleActionJs(a.data ?? null, 'ASSIGN', new Map([...base, ['field', field], ['attributeType', attributeType]]), null))
            continue
        }
        out.push(
            new E.RuleActionJs(
                a.data || null,
                a.programRuleActionType,
                new Map([
                    ...base,
                    ['attributeType', attributeType],
                    ...opt('field', field),
                    ...opt('content', a.content),
                    ...opt('location', a.location),
                    ...opt('programStageSection', a.programStageSection?.id),
                    ...opt('programStage', a.programStage?.id),
                    ...opt('option', a.option?.id),
                    ...opt('optionGroup', a.optionGroup?.id),
                ]),
                null,
            ),
        )
    }
    return out
}

export function buildContext(E: Mod, fx: Fixtures, rules: RawRule[] = fx.programRules): Engine.RuleEngineContextJs {
    const variablesByName = new Map(fx.programRuleVariables.map((v) => [v.name, v]))
    const optionSets = new Map(fx.optionSets.map((os) => [os.id, os.options.map((o) => new E.Option(o.name, o.code))]))
    const ruleJs = rules.map(
        (r) => new E.RuleJs(r.condition ?? '', buildActions(E, r, variablesByName), r.id, r.name, r.programStage?.id ?? null, r.priority ?? null),
    )
    const variables = fx.programRuleVariables.map((v) => {
        const source = v.dataElement ?? v.trackedEntityAttribute
        const type = (E.RuleVariableType as any)[v.programRuleVariableSourceType] ?? E.RuleVariableType.CALCULATED_VALUE
        return new E.RuleVariableJs(
            type,
            // `name`, not `displayName`: expressions reference the untranslated name
            v.name,
            v.useCodeForOptionSet ?? false,
            (source?.optionSet && optionSets.get(source.optionSet.id)) || [],
            source?.id ?? '',
            ruleValueType(E, source?.valueType ?? v.valueType),
            v.programStage?.id ?? null,
        )
    })
    const ouGroups = new Map<string, string[]>()
    for (const g of fx.orgUnit.organisationUnitGroups) {
        ouGroups.set(g.id, [fx.orgUnit.id])
        if (g.code) ouGroups.set(g.code, [fx.orgUnit.id])
    }
    const supplementary = new E.RuleSupplementaryDataJs(
        fx.me.userGroups.map((g) => g!.id),
        fx.me.userRoles.map((r) => r!.id),
        ouGroups,
    )
    // constants are referenced as C{uid}; the key must be the uid
    const constants = new Map(fx.constants.map((c) => [c.id, String(c.value)]))
    return new E.RuleEngineContextJs(ruleJs, variables, supplementary, constants)
}

export function buildEvent(E: Mod, fx: Fixtures, ev: RawEvent): Engine.RuleEventJs {
    const dataValues = ev.dataValues.flatMap((dv) => {
        const v = normaliseValue(dv.value, fx.valueTypes[dv.dataElement])
        return v === null ? [] : [new E.RuleDataValue(dv.dataElement, v)]
    })
    return new E.RuleEventJs(
        ev.event,
        ev.programStage,
        fx.stageNames[ev.programStage] ?? '',
        (E.RuleEventStatus as any)[ev.status] ?? E.RuleEventStatus.ACTIVE,
        localDate(E, ev.occurredAt),
        instant(E, ev.createdAt) ?? E.RuleInstant.now(),
        instant(E, ev.createdAtClient),
        localDate(E, ev.scheduledAt),
        localDate(E, ev.completedAt),
        ev.orgUnit,
        ev.orgUnit === fx.orgUnit.id ? (fx.orgUnit.code ?? null) : null,
        dataValues,
    )
}

export function buildEnrollment(E: Mod, fx: Fixtures, en: RawEnrollment): Engine.RuleEnrollmentJs {
    const attrs = en.attributes.flatMap((a) => {
        const v = normaliseValue(a.value, fx.valueTypes[a.attribute])
        return v === null ? [] : [new E.RuleAttributeValue(a.attribute, v)]
    })
    return new E.RuleEnrollmentJs(
        en.enrollment,
        fx.programName,
        localDate(E, en.occurredAt ?? en.enrolledAt)!,
        localDate(E, en.enrolledAt)!,
        (E.RuleEnrollmentStatus as any)[en.status] ?? E.RuleEnrollmentStatus.ACTIVE,
        en.orgUnit,
        en.orgUnit === fx.orgUnit.id ? (fx.orgUnit.code ?? null) : null,
        attrs,
    )
}

export function buildInput(E: Mod, fx: Fixtures, event: RawEvent, enrollment: RawEnrollment | null, otherEvents: RawEvent[]) {
    return {
        event: buildEvent(E, fx, event),
        enrollment: enrollment ? buildEnrollment(E, fx, enrollment) : null,
        otherEvents: otherEvents.filter((e) => e.event !== event.event).map((e) => buildEvent(E, fx, e)),
    }
}

export interface Effect {
    ruleId: string
    actionId?: string
    type: string
    data: string | null | undefined
    values: Record<string, string>
}
export const toEffects = (effects: Engine.RuleEffectJs[]): Effect[] =>
    effects.map((e) => {
        const values = Object.fromEntries(e.ruleAction.values) as Record<string, string>
        return { ruleId: e.ruleId, actionId: values.id, type: e.ruleAction.type, data: e.data, values }
    })
