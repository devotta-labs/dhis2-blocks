import type { EventFormRules, Values } from '@dhis2-blocks/event-form'

type Effects = NonNullable<EventFormRules['effects']>
type Graph = NonNullable<EventFormRules['graph']>
type Attribution = ReturnType<EventFormRules['explain']>[number]

/** What a rule action does to a field or section. */
export type EffectKind =
    | 'hidden'
    | 'hiddenSection'
    | 'mandatory'
    | 'assigned'
    | 'error'
    | 'warning'
    | 'options'

export interface Effect {
    kind: EffectKind
    /** A field id, a section id, or `'form'` for a message about the whole event. */
    targetId: string
    /** The assigned value, or the message text. */
    detail?: string
    by: Attribution
}

/** Every effect, keyed so the same effect has the same key from one evaluation to the next. */
export const effectMap = (effects: Effects | undefined) => {
    const map = new Map<string, Effect>()
    if (effects === undefined) {
        return map
    }
    const add = (effect: Effect) =>
        map.set(
            `${effect.kind}|${effect.targetId}|${effect.by.actionId}|${effect.kind === 'assigned' ? '' : (effect.detail ?? '')}`,
            effect
        )
    for (const [targetId, list] of effects.hiddenFields) {
        list.forEach((by) => add({ kind: 'hidden', targetId, by }))
    }
    for (const [targetId, list] of effects.hiddenSections) {
        list.forEach((by) => add({ kind: 'hiddenSection', targetId, by }))
    }
    for (const [targetId, list] of effects.mandatoryFields) {
        list.forEach((by) => add({ kind: 'mandatory', targetId, by }))
    }
    for (const [targetId, assigned] of effects.assignedValues) {
        add({
            kind: 'assigned',
            targetId,
            detail: assigned.value ?? '',
            by: assigned.by,
        })
    }
    for (const [targetId, messages] of effects.messages) {
        for (const message of messages) {
            add({
                kind:
                    message.kind === 'error' ||
                    message.kind === 'errorOnComplete'
                        ? 'error'
                        : 'warning',
                targetId,
                detail: message.text,
                by: message.by,
            })
        }
    }
    for (const [targetId, list] of effects.optionAttributions) {
        list.forEach((by) => add({ kind: 'options', targetId, by }))
    }
    return map
}

/** Every effect, by the field, section or `'form'` it acts on. */
export const effectsByTarget = (
    effects: Effects | undefined
): Map<string, Effect[]> => {
    const byTarget = new Map<string, Effect[]>()
    for (const effect of effectMap(effects).values()) {
        byTarget.set(effect.targetId, [
            ...(byTarget.get(effect.targetId) ?? []),
            effect,
        ])
    }
    return byTarget
}

export interface EffectChange {
    /** `changed` is an assignment whose value changed. */
    direction: 'started' | 'stopped' | 'changed'
    effect: Effect
}

export const diffEffects = (
    before: ReadonlyMap<string, Effect>,
    after: ReadonlyMap<string, Effect>
): EffectChange[] => {
    const changes: EffectChange[] = []
    for (const [key, effect] of after) {
        const previous = before.get(key)
        if (previous === undefined) {
            changes.push({ direction: 'started', effect })
        } else if (previous.detail !== effect.detail) {
            changes.push({ direction: 'changed', effect })
        }
    }
    for (const [key, effect] of before) {
        if (!after.has(key)) {
            changes.push({ direction: 'stopped', effect })
        }
    }
    return changes
}

/** Fields whose value changed, leaving out the ones in `ignore` (rule assignments). */
export const changedAnswers = (
    before: Values,
    after: Values,
    ignore: ReadonlySet<string>
): string[] =>
    [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
        (id) => !ignore.has(id) && (before[id] ?? '') !== (after[id] ?? '')
    )

export interface ChangeGroup {
    kind: EffectKind
    direction: EffectChange['direction']
    ruleId: string
    ruleName: string
    targetIds: string[]
    /** The value or message, for a group of one. */
    detail?: string
}

/** Changes of the same kind and direction by the same rule, as one line. */
export const groupChanges = (
    changes: readonly EffectChange[]
): ChangeGroup[] => {
    const groups = new Map<string, ChangeGroup>()
    for (const { direction, effect } of changes) {
        const key = `${effect.kind}|${direction}|${effect.by.ruleId}|${effect.detail ?? ''}`
        const group = groups.get(key)
        if (group === undefined) {
            groups.set(key, {
                kind: effect.kind,
                direction,
                ruleId: effect.by.ruleId,
                ruleName: effect.by.ruleName,
                targetIds: [effect.targetId],
                detail: effect.detail,
            })
        } else if (!group.targetIds.includes(effect.targetId)) {
            group.targetIds.push(effect.targetId)
        }
    }
    return [...groups.values()]
}

export interface FieldLens {
    /** Rule actions acting on the field now, with what each does to it. */
    acting: { by: Attribution; kinds: EffectKind[] }[]
    /** Rules that can change the field but do not now. */
    dormant: string[]
    /** Fields that rules reading this field can change. */
    controls: string[]
    /** The rules behind `controls`. */
    controllers: string[]
}

/** Everything the lens shows for one field. `effectsOn` is `effectsByTarget` of the effects. */
export const fieldLens = (
    effectsOn: ReadonlyMap<string, readonly Effect[]>,
    graph: Graph | undefined,
    explain: EventFormRules['explain'],
    fieldId: string
): FieldLens => {
    const all = effectsOn.get(fieldId) ?? []
    const acting = explain(fieldId).map((by) => ({
        by,
        kinds: [
            ...new Set(
                all
                    .filter((effect) => effect.by.actionId === by.actionId)
                    .map((effect) => effect.kind)
            ),
        ],
    }))
    const actingRules = new Set(acting.map(({ by }) => by.ruleId))
    const dormant = (graph?.fieldWriters.get(fieldId) ?? []).filter(
        (ruleId) => !actingRules.has(ruleId)
    )
    const controllers = graph?.fieldReaders.get(fieldId) ?? []
    const controls = [
        ...new Set(
            controllers.flatMap(
                (ruleId) => graph?.rules.get(ruleId)?.writesFields ?? []
            )
        ),
    ].filter((id) => id !== fieldId)
    return { acting, dormant, controls, controllers }
}
