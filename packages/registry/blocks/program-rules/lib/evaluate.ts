import { buildEngineInput } from './buildInput'
import type {
    Attribution,
    EventRuleInput,
    ProgramRuleActionMetadata,
    RuleContext,
    RuleDisplayItem,
    RuleEffects,
    RuleEngineModule,
    RuleMessage,
} from './types'

const MESSAGE_KINDS = new Map<string, RuleMessage['kind']>([
    ['SHOWERROR', 'error'],
    ['SHOWWARNING', 'warning'],
    ['ERRORONCOMPLETE', 'errorOnComplete'],
    ['WARNINGONCOMPLETE', 'warningOnComplete'],
])

/** Effects with nothing in them: what a row gets when no rule acts on it. */
export const emptyEffects = (): RuleEffects => ({
    hiddenFields: new Map(),
    hiddenSections: new Map(),
    mandatoryFields: new Map(),
    assignedValues: new Map(),
    messages: new Map(),
    hiddenOptions: new Map(),
    optionGroups: new Map(),
    optionAttributions: new Map(),
    displayTexts: [],
    keyValuePairs: [],
    hiddenProgramStages: new Set(),
    programStageAttributions: new Map(),
})

const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
    map.set(key, [...(map.get(key) ?? []), value])
}

const text = (action: ProgramRuleActionMetadata) =>
    action.displayContent ?? action.content ?? ''

const displayItem = (
    action: ProgramRuleActionMetadata,
    data: string,
    by: Attribution
): RuleDisplayItem => ({
    location: action.location === 'indicators' ? 'indicators' : 'feedback',
    label: text(action),
    value: data,
    by,
})

const optionGroupsOf = (effects: RuleEffects, field: string) => {
    const groups = effects.optionGroups.get(field) ?? {
        hidden: new Set<string>(),
        shown: new Set<string>(),
    }
    effects.optionGroups.set(field, groups)
    return groups
}

/** Runs every rule for one event and sorts the effects by what they do. Pure. */
export const evaluateEventRules = (
    engine: RuleEngineModule,
    context: RuleContext,
    input: EventRuleInput
): RuleEffects => {
    const built = buildEngineInput(engine, context, input)
    const raw = context.engine.evaluateEvent(
        built.event,
        built.enrollment,
        built.otherEvents,
        context.engineContext
    )
    const effects = emptyEffects()
    for (const effect of raw) {
        const values = effect.ruleAction.values
        const actionId = values.get('id')
        const ruleId = values.get('ruleId') ?? effect.ruleId
        const action =
            actionId === undefined
                ? undefined
                : context.actionMetadata.get(actionId)
        const by =
            actionId === undefined
                ? undefined
                : context.ruleInfo.get(ruleId)?.actions.get(actionId)
        if (action === undefined || by === undefined) {
            continue
        }
        const field = values.get('field')
        const data = effect.data ?? ''
        const kind = MESSAGE_KINDS.get(action.type)
        if (kind !== undefined) {
            push(effects.messages, field ?? 'form', {
                kind,
                text: [text(action), data].filter(Boolean).join(' ').trim(),
                by,
            })
            continue
        }
        switch (action.type) {
            case 'HIDEFIELD':
                if (field !== undefined) push(effects.hiddenFields, field, by)
                break
            case 'SETMANDATORYFIELD':
                if (field !== undefined)
                    push(effects.mandatoryFields, field, by)
                break
            case 'HIDESECTION':
                if (action.sectionId !== undefined) {
                    push(effects.hiddenSections, action.sectionId, by)
                }
                break
            case 'ASSIGN':
                // Later assignments run later (priority order), so they win.
                if (field !== undefined) {
                    effects.assignedValues.set(field, {
                        value: effect.data ?? null,
                        by,
                    })
                }
                break
            case 'HIDEOPTION':
                if (field !== undefined && action.option !== undefined) {
                    effects.hiddenOptions.set(
                        field,
                        new Set([
                            ...(effects.hiddenOptions.get(field) ?? []),
                            action.option.code,
                        ])
                    )
                    push(effects.optionAttributions, field, by)
                }
                break
            case 'HIDEOPTIONGROUP':
                if (field !== undefined && action.optionGroup !== undefined) {
                    optionGroupsOf(effects, field).hidden.add(
                        action.optionGroup.id
                    )
                    push(effects.optionAttributions, field, by)
                }
                break
            case 'SHOWOPTIONGROUP':
                if (field !== undefined && action.optionGroup !== undefined) {
                    optionGroupsOf(effects, field).shown.add(
                        action.optionGroup.id
                    )
                    push(effects.optionAttributions, field, by)
                }
                break
            case 'DISPLAYTEXT':
                effects.displayTexts.push(displayItem(action, data, by))
                break
            case 'DISPLAYKEYVALUEPAIR':
                effects.keyValuePairs.push(displayItem(action, data, by))
                break
            case 'HIDEPROGRAMSTAGE':
                if (action.programStageId !== undefined) {
                    effects.hiddenProgramStages.add(action.programStageId)
                    push(
                        effects.programStageAttributions,
                        action.programStageId,
                        by
                    )
                }
                break
            default:
            // Server-side actions (messages, scheduling, event creation) have no client effect.
        }
    }
    return effects
}

/** Every rule action that hid, required, assigned, messaged or filtered the options of a field, once each. */
export const explainField = (
    effects: RuleEffects,
    fieldId: string
): Attribution[] => {
    const assigned = effects.assignedValues.get(fieldId)
    const all = [
        ...(effects.hiddenFields.get(fieldId) ?? []),
        ...(effects.mandatoryFields.get(fieldId) ?? []),
        ...(assigned === undefined ? [] : [assigned.by]),
        ...(effects.messages.get(fieldId) ?? []).map((message) => message.by),
        ...(effects.optionAttributions.get(fieldId) ?? []),
    ]
    return [...new Map(all.map((by) => [by.actionId, by])).values()]
}
