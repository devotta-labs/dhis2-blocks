import type { RuleForm, RuleOutcome, RuleValues } from './overlay'
import type { Attribution, RuleDependencyGraph, RuleOutsideRead } from './types'

/** The key of the event date among the answers a rule read. */
export const EVENT_DATE = 'occurredAt'

/** What a value's display needs: its value type and, for an option set, its options. */
export interface RuleValueMeta {
    valueType: string
    options?: ReadonlyArray<{ code: string; name: string }>
}

/** One answer a rule read. */
export interface RuleReason {
    /** The field, `EVENT_DATE`, or an attribute or data element outside the form. */
    fieldId: string
    label: string
    /** The display value. */
    value: string | undefined
    /** Absent for the form's own answers. */
    from?: RuleOutsideRead['from']
}

export interface Blame {
    effect:
        | 'hidden'
        | 'assigned'
        | 'required'
        | 'options'
        | 'message'
        | 'sectionHidden'
    ruleName: string
    /** The rule's expression, as written. */
    condition: string
    /**
     * The answers the rule read: the form's, the event date, then what it read outside the form or in the previous
     * event, as they are now.
     */
    because: RuleReason[]
    /** Assigned: the display value set. Hidden: the answer not saved while hidden. Message: its text. */
    value?: string
    /** Hidden: DHIS2 holds an answer, which saving removes. */
    stored?: boolean
}

export interface BlameContext {
    form: RuleForm
    graph?: RuleDependencyGraph
    effective: RuleValues
    /** What DHIS2 holds. */
    stored: RuleValues
    eventDate?: string
    /** The text a value shows as; `undefined` or `''` when it has none. */
    display(value: string | undefined, meta: RuleValueMeta): string | undefined
    /** The attributes and other events' data elements the rules read, by id. */
    outside?: ReadonlyMap<string, RuleOutsideRead>
}

const displayOf = (
    value: string | undefined,
    meta: RuleValueMeta,
    context: BlameContext
) => context.display(value, meta) || undefined

/** The display value of one of the form's fields. */
export const fieldDisplay = (
    fieldId: string,
    value: string | undefined,
    context: BlameContext
) => {
    const field = context.form.fields.get(fieldId)?.field
    return field && displayOf(value, field, context)
}

const becauseOf = (by: Attribution, context: BlameContext) => {
    const { form, graph, effective, eventDate, outside } = context
    const readsVariables = graph?.rules.get(by.ruleId)?.readsVariables ?? []
    const reasons: RuleReason[] = []
    const elsewhere: RuleReason[] = []
    for (const fieldId of by.readsFields) {
        const label = form.fields.get(fieldId)?.label
        const read = outside?.get(fieldId)
        const previous =
            read?.from.kind === 'event' &&
            read.from.previous === true &&
            readsVariables.includes(read.variable)
        if (label !== undefined) {
            reasons.push({
                fieldId,
                label,
                value: fieldDisplay(fieldId, effective[fieldId], context),
            })
        }
        if (read !== undefined && (label === undefined || previous)) {
            elsewhere.push({
                fieldId,
                label: label ?? read.label,
                value: displayOf(read.value, read, context),
                from: read.from,
            })
        }
    }
    if (
        graph?.rules
            .get(by.ruleId)
            ?.readsProgramVariables.includes('event_date') === true
    ) {
        reasons.push({
            fieldId: EVENT_DATE,
            label: form.eventDateLabel,
            value: displayOf(eventDate, { valueType: 'DATE' }, context),
        })
    }
    return [...reasons, ...elsewhere] satisfies RuleReason[]
}

/** Every blame per field id, per fully hidden section id, and under `'form'`. */
export const explain = (outcome: RuleOutcome, context: BlameContext) => {
    const blames = new Map<string, Blame[]>()
    const add = (
        key: string,
        effect: Blame['effect'],
        by: Attribution,
        value?: string,
        stored?: boolean
    ) => {
        const blame: Blame = {
            effect,
            ruleName: by.ruleName,
            condition: by.condition,
            because: becauseOf(by, context),
        }
        if (value !== undefined) {
            blame.value = value
        }
        if (stored !== undefined) {
            blame.stored = stored
        }
        blames.set(key, [...(blames.get(key) ?? []), blame])
    }

    for (const [fieldId, { by, section, cleared }] of outcome.hidden) {
        add(
            fieldId,
            section ? 'sectionHidden' : 'hidden',
            by,
            fieldDisplay(fieldId, cleared, context),
            section ? undefined : context.stored[fieldId] !== undefined
        )
    }
    for (const [sectionId, by] of outcome.hiddenSections) {
        add(sectionId, 'sectionHidden', by)
    }
    for (const [fieldId, { value, by }] of outcome.assigned) {
        add(fieldId, 'assigned', by, fieldDisplay(fieldId, value, context))
    }
    for (const [fieldId, by] of outcome.requiredBy) {
        add(fieldId, 'required', by)
    }
    for (const [fieldId, by] of outcome.optionsBy) {
        add(fieldId, 'options', by)
    }
    for (const [key, messages] of outcome.messages) {
        for (const { by, text } of messages) {
            add(key, 'message', by, text)
        }
    }
    return blames satisfies ReadonlyMap<string, readonly Blame[]>
}
