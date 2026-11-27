import { Result } from 'better-result'
import type {
    Attribution,
    RuleContext,
    RuleDisplayItem,
    RuleEffects,
    RuleEventInput,
    RuleMessage,
} from './types'

/** Field id → value, empty values absent: what a form holds. */
export type RuleValues = Readonly<Record<string, string>>

/** What the overlay and the explanations read of a stage's form. */
export interface RuleForm {
    /** Every field of the stage, shown or not. */
    fields: ReadonlyMap<
        string,
        {
            id: string
            label: string
            compulsory: boolean
            field: {
                valueType: string
                options?: ReadonlyArray<{ code: string; name: string }>
            }
        }
    >
    sections: ReadonlyArray<{ id: string; fieldIds: ReadonlyArray<string> }>
    eventDateLabel: string
}

/** Whether two sets of values hold the same value for every field. */
export const sameValues = (a: RuleValues, b: RuleValues) => {
    const keys = Object.keys(a)
    return (
        keys.length === Object.keys(b).length &&
        keys.every((key) => a[key] === b[key])
    )
}

interface HiddenField {
    by: Attribution
    /** Hidden through its section rather than by its own HIDEFIELD. */
    section: boolean
    /** The entered value that is not saved while the field is hidden. */
    cleared?: string
}

export interface RuleOutcome {
    effective: RuleValues
    hidden: ReadonlyMap<string, HiddenField>
    /** Sections with no field left shown. */
    hiddenSections: ReadonlyMap<string, Attribution>
    assigned: ReadonlyMap<
        string,
        { value: string | undefined; by: Attribution }
    >
    /** Compulsory, or required by a rule. */
    required: ReadonlySet<string>
    /** Required by a rule only. */
    requiredBy: ReadonlyMap<string, Attribution>
    hiddenOptions: ReadonlyMap<string, ReadonlySet<string>>
    optionsBy: ReadonlyMap<string, Attribution>
    /** Keyed by shown field, or `'form'`: the form's own and those on fields outside the stage. */
    messages: ReadonlyMap<string, readonly RuleMessage[]>
    /** Display texts, then key-value pairs. */
    display: readonly RuleDisplayItem[]
}

const assignable = (form: RuleForm, fieldId: string, value: string | null) => {
    if (value === null || value === '') {
        return undefined
    }
    const field = form.fields.get(fieldId)?.field
    if (field?.options === undefined) {
        return value
    }
    const codes = new Set(field.options.map(({ code }) => code))
    const parts = field.valueType === 'MULTI_TEXT' ? value.split(',') : [value]
    return parts.every((part) => codes.has(part)) ? value : undefined
}

/**
 * What the form shows and saves once the rules' effects are laid over what was entered. A required field is never
 * hidden; a HIDEFIELD clears its value unless an ASSIGN targets it; a hidden section keeps its fields' values.
 */
export const overlay = (
    entered: RuleValues,
    effects: RuleEffects,
    form: RuleForm,
    optionGroups: ReadonlyMap<string, ReadonlySet<string>>
) => {
    const inStage = (fieldId: string) => form.fields.has(fieldId)
    const requiredBy = new Map(
        [...effects.mandatoryFields].flatMap(
            ([fieldId, [by]]) =>
                (inStage(fieldId) && by !== undefined
                    ? [[fieldId, by]]
                    : []) satisfies Array<[string, Attribution]>
        )
    )
    const required = new Set([
        ...[...form.fields.values()]
            .filter(({ compulsory }) => compulsory)
            .map(({ id }) => id),
        ...requiredBy.keys(),
    ])

    const hidden = new Map<string, HiddenField>()
    const hide = (fieldId: string, [by]: Attribution[], section: boolean) => {
        if (
            by !== undefined &&
            inStage(fieldId) &&
            !required.has(fieldId) &&
            !hidden.has(fieldId)
        ) {
            hidden.set(fieldId, { by, section })
        }
    }
    for (const [fieldId, by] of effects.hiddenFields) {
        hide(fieldId, by, false)
    }
    for (const [sectionId, by] of effects.hiddenSections) {
        for (const fieldId of form.sections.find(({ id }) => id === sectionId)
            ?.fieldIds ?? []) {
            hide(fieldId, by, true)
        }
    }

    const effective = new Map(Object.entries(entered))
    const assigned = new Map<
        string,
        { value: string | undefined; by: Attribution }
    >()
    for (const [fieldId, { value, by }] of effects.assignedValues) {
        if (inStage(fieldId)) {
            assigned.set(fieldId, {
                value: assignable(form, fieldId, value),
                by,
            })
        }
    }
    for (const [fieldId, field] of hidden) {
        if (!field.section && !assigned.has(fieldId)) {
            if (entered[fieldId] !== undefined) {
                field.cleared = entered[fieldId]
            }
            effective.delete(fieldId)
        }
    }
    for (const [fieldId, { value }] of assigned) {
        if (value === undefined) {
            effective.delete(fieldId)
        } else {
            effective.set(fieldId, value)
        }
    }

    const hiddenSections = new Map(
        [...effects.hiddenSections].flatMap(([sectionId, [by]]) => {
            const section = form.sections.find(({ id }) => id === sectionId)
            return (
                section !== undefined &&
                by !== undefined &&
                section.fieldIds.every((fieldId) => hidden.has(fieldId))
                    ? [[sectionId, by]]
                    : []
            ) satisfies Array<[string, Attribution]>
        })
    )

    const codesOf = (groups: Iterable<string>) =>
        [...groups].flatMap((group) => [...(optionGroups.get(group) ?? [])])
    const hiddenOptions = new Map<string, ReadonlySet<string>>()
    for (const { id, field } of form.fields.values()) {
        const groups = effects.optionGroups.get(id)
        const hiddenCodes = new Set([
            ...(effects.hiddenOptions.get(id) ?? []),
            ...codesOf(groups?.hidden ?? []),
        ])
        if (groups !== undefined && groups.shown.size > 0) {
            const shown = new Set(codesOf(groups.shown))
            for (const { code } of field.options ?? []) {
                if (!shown.has(code)) {
                    hiddenCodes.add(code)
                }
            }
        }
        if (hiddenCodes.size > 0) {
            hiddenOptions.set(id, hiddenCodes)
        }
    }
    const optionsBy = new Map(
        [...effects.optionAttributions].flatMap(
            ([fieldId, [by]]) =>
                (hiddenOptions.has(fieldId) && by !== undefined
                    ? [[fieldId, by]]
                    : []) satisfies Array<[string, Attribution]>
        )
    )

    const messages = new Map<string, RuleMessage[]>()
    for (const [key, list] of effects.messages) {
        const to = key === 'form' || !inStage(key) ? 'form' : key
        if (!hidden.has(to)) {
            messages.set(to, [...(messages.get(to) ?? []), ...list])
        }
    }

    return {
        effective: Object.fromEntries(effective),
        hidden,
        hiddenSections,
        assigned,
        required,
        requiredBy,
        hiddenOptions,
        optionsBy,
        messages,
        display: [...effects.displayTexts, ...effects.keyValuePairs],
    } satisfies RuleOutcome
}

/**
 * The rules' outcome once the values settle: each run reads the values the last one set or cleared, so a chain of rules
 * reading what another set works through. Within one evaluation only an ASSIGN to a program rule variable reaches the
 * rules after it; one that names a data element is read on the next run. Rules that keep undoing each other stop after
 * `maxRuns`, `capped`. The first run reads `start`, the entered values unless given.
 */
export const runRules: (
    entered: RuleValues,
    evaluate: (values: RuleValues) => Result<RuleEffects, Error>,
    form: RuleForm,
    optionGroups: ReadonlyMap<string, ReadonlySet<string>>,
    maxRuns: number,
    start?: RuleValues
) => Result<
    { effects: RuleEffects; outcome: RuleOutcome; capped: boolean },
    Error
> = (entered, evaluate, form, optionGroups, maxRuns, start = entered) => {
    let input = start
    for (let run = 1; ; run++) {
        const evaluation = evaluate(input)
        if (Result.isError(evaluation)) {
            return Result.err(evaluation.error)
        }
        const outcome = overlay(entered, evaluation.value, form, optionGroups)
        const settled = sameValues(outcome.effective, input)
        if (settled || run >= maxRuns) {
            return Result.ok({
                effects: evaluation.value,
                outcome,
                capped: !settled,
            })
        }
        input = outcome.effective
    }
}

/** The event the rules run for, without its values. */
export type RuleSettleEvent = Omit<RuleEventInput, 'dataValues'>

/** A settled outcome, and what it was settled for. */
export interface RuleSettled {
    entered: RuleValues
    event: RuleSettleEvent
    effects: RuleEffects
    outcome: RuleOutcome
    /** The rules kept changing the values and were stopped. */
    capped: boolean
}

interface SettlePlan {
    read: ReadonlySet<string>
    written: ReadonlySet<string>
    readsEventDate: boolean
    runs?: number
}

const plans = new WeakMap<RuleContext['graph'], SettlePlan>()

const planOf = ({
    graph,
    requirements,
}: Pick<RuleContext, 'graph' | 'requirements'>) => {
    const known = plans.get(graph)
    if (known !== undefined) {
        return known satisfies SettlePlan
    }
    const feeds = new Map<string, Set<string>>()
    for (const { readsFields, writesValues } of graph.rules.values()) {
        for (const field of writesValues) {
            const from = feeds.get(field) ?? new Set<string>()
            readsFields.forEach((read) => from.add(read))
            feeds.set(field, from)
        }
    }
    const levels = new Map<string, number>()
    const visiting = new Set<string>()
    const levelOf: (field: string) => number = (field) => {
        const from = feeds.get(field)
        if (from === undefined) {
            return 0
        }
        const known = levels.get(field)
        if (known !== undefined) {
            return known
        }
        if (visiting.has(field)) {
            return Infinity
        }
        visiting.add(field)
        const level = 1 + Math.max(0, ...[...from].map(levelOf))
        visiting.delete(field)
        levels.set(field, level)
        return level
    }
    const deepest = Math.max(0, ...[...feeds.keys()].map(levelOf))
    const plan: SettlePlan = {
        read: new Set(graph.fieldReaders.keys()),
        written: new Set(feeds.keys()),
        readsEventDate:
            requirements.otherEvents ||
            [...graph.rules.values()].some(({ readsProgramVariables }) =>
                readsProgramVariables.includes('event_date')
            ),
        runs: Number.isFinite(deepest) ? deepest + 1 : undefined,
    }
    plans.set(graph, plan)
    return plan satisfies SettlePlan
}

const changedKeys = (
    a: RuleValues | RuleSettleEvent,
    b: RuleValues | RuleSettleEvent
) => {
    const before = new Map(Object.entries(a))
    const after = new Map(Object.entries(b))
    return [...new Set([...before.keys(), ...after.keys()])].filter(
        (key) => before.get(key) !== after.get(key)
    )
}

/**
 * `runRules` for `entered` and `event`, starting from `last`, the settled outcome of the same rules before a change.
 * When no rule reads what changed, its effects stand without running the engine. Otherwise the first run reads the
 * values `last` settled on, and what was entered in a field that changed, so a chain the change leaves alone confirms
 * in one run; that is only done when the rules settle to one outcome from any start within `maxRuns`, so the result is
 * always what a settle from the entered values gives.
 */
export const settleRules = (
    last: RuleSettled | undefined,
    entered: RuleValues,
    event: RuleSettleEvent,
    {
        context,
        evaluate,
        form,
        optionGroups,
        maxRuns,
    }: {
        context: Pick<RuleContext, 'graph' | 'requirements'>
        evaluate: (event: RuleEventInput) => Result<RuleEffects, Error>
        form: RuleForm
        optionGroups: ReadonlyMap<string, ReadonlySet<string>>
        maxRuns: number
    }
) => {
    const plan = planOf(context)
    if (
        last !== undefined &&
        changedKeys(last.entered, entered).every(
            (field) => !plan.read.has(field)
        ) &&
        changedKeys(last.event, event).every(
            (key) => key === 'occurredAt' && !plan.readsEventDate
        )
    ) {
        return Result.ok({
            ...last,
            entered,
            event,
            outcome: overlay(entered, last.effects, form, optionGroups),
        }) satisfies Result<RuleSettled, Error>
    }
    let start = entered
    if (last !== undefined && plan.runs !== undefined && plan.runs <= maxRuns) {
        const warm = { ...entered }
        for (const field of plan.written) {
            if (last.entered[field] !== entered[field]) {
                continue
            }
            const value = last.outcome.effective[field]
            if (value === undefined) {
                delete warm[field]
            } else {
                warm[field] = value
            }
        }
        start = warm
    }
    return runRules(
        entered,
        (values) => evaluate({ ...event, dataValues: { ...values } }),
        form,
        optionGroups,
        maxRuns,
        start
    ).map((run) => ({ entered, event, ...run })) satisfies Result<
        RuleSettled,
        Error
    >
}
