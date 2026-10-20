/*
 * What DHIS2 Capture shows for an event, next to what this form shows, as one comparable view.
 *
 * The Capture side re-implements, from dhis2/capture-app at c40f022 (BSD-2-Clause), the code
 * between the rule engine and the form state:
 * - `rules/RuleEngine/helpers/rulesEffectsProcessor.ts`: effects per action type, assigned
 *   values normalised by value type (`normalizeRuleVariable` + `outputConverter`);
 * - `rules/postProcessRulesEffects.ts`: effects limited to the stage's fields, a hidden section
 *   hides its fields, a compulsory field (metadata or SETMANDATORYFIELD) is never hidden, every
 *   HIDEFIELD also assigns `null` and a real ASSIGN to the same field wins over that, an ASSIGN of
 *   a code outside the field's option set assigns `null`;
 * - `reducers/descriptions/form.reducerDescription.ts`: every ASSIGN (the `null`s too) is written
 *   into the form values;
 * - `components/D2Form`: messages are kept per field whether it is shown or not; a rule error on
 *   a field hidden by HIDEFIELD still fails the section's validation, and the completion dialog
 *   (`withSaveHandler`) lists errors and warnings on complete for every field of the stage.
 *
 * Capture evaluates once per field change, against values that already hold the previous run's
 * writes, and never re-runs on its own writes. `captureSettled` repeats that evaluation until it
 * writes nothing new: what Capture shows once the user's later edits (or a save and reopen) have
 * let it converge. `captureFirstRun` is what it shows right after the change.
 *
 * Both sides share the rule context and the engine input (`buildRuleContext`, `buildEngineInput`),
 * so differences in how rules, variables and values are converted are out of scope here.
 */
import { buildEngineInput } from '@/registry/program-rules/lib/buildInput'
import { evaluateEventRules } from '@/registry/program-rules/lib/evaluate'
import type {
    EventRuleInput,
    RuleContext,
    RuleEngineModule,
    RuleMessage,
} from '@/registry/program-rules/lib/types'
import type { DataElementMeta, StageMetadata } from '../../api/schemas'
import { buildFormModel } from '../buildFormModel'
import { overlay, type Values } from '../overlay'

export interface ParityScenario {
    engine: RuleEngineModule
    context: RuleContext
    metadata: StageMetadata
    /** The event under test; its `dataValues` are replaced by the values being compared. */
    input: EventRuleInput
}

/** What a user sees and what gets saved, in a form both pipelines can be reduced to. */
export interface FormView {
    /** Stage fields on screen. */
    visible: string[]
    /** The values that would be saved. */
    values: Record<string, string>
    /** Visible fields that are required. */
    required: string[]
    /** `<fieldId|form> <kind>: <text>` for every rule message on a visible field or the form. */
    messages: string[]
    /** Rule messages on hidden fields that still block saving or show when completing. */
    hiddenFieldMessages: string[]
    /** Option codes offered by visible option-set fields. */
    options: Record<string, string[]>
}

const withValues = (input: EventRuleInput, values: Values): EventRuleInput => ({
    ...input,
    event: { ...input.event, dataValues: { ...values } },
})

const sorted = (items: Iterable<string>): string[] => [...items].sort()

const messageLine = (key: string, kind: RuleMessage['kind'], text: string) =>
    `${key} ${kind}: ${text.trim()}`

// ---- This form: two passes, the overlay and the form model ----------------

/** The two passes of `useEventFormModel`, without React. */
export const oursView = (
    scenario: ParityScenario,
    stored: Values
): FormView => {
    const { engine, context, metadata, input } = scenario
    const first = evaluateEventRules(engine, context, withValues(input, stored))
    const second = evaluateEventRules(
        engine,
        context,
        withValues(
            input,
            overlay(stored, first, metadata.dataElements).effective
        )
    )
    const { effective } = overlay(stored, second, metadata.dataElements)
    const model = buildFormModel(undefined, {
        metadata,
        effective,
        stored,
        effects: second,
        optionGroupOptions: context.optionGroupOptions,
        fieldErrors: {},
        showAllErrors: false,
        isCompleting: false,
    })
    const visible = [...model.fields.values()].filter((field) => !field.hidden)
    const visibleIds = new Set(visible.map((field) => field.id))
    const messages: string[] = []
    for (const [key, list] of second.messages) {
        if (key === 'form' || visibleIds.has(key)) {
            for (const message of list) {
                messages.push(messageLine(key, message.kind, message.text))
            }
        }
    }
    // The model drops a hidden field's messages and validation skips hidden fields.
    const hiddenFieldMessages = [...model.fields.values()]
        .filter((field) => field.hidden)
        .flatMap((field) => [
            ...field.messages.ruleErrors.map((message) =>
                messageLine(field.id, message.kind, message.text)
            ),
            ...(field.messages.errorOnComplete === undefined
                ? []
                : [
                      messageLine(
                          field.id,
                          'errorOnComplete',
                          field.messages.errorOnComplete
                      ),
                  ]),
        ])
    return {
        visible: sorted(visibleIds),
        values: { ...effective },
        required: sorted(
            visible.filter((field) => field.required).map((field) => field.id)
        ),
        messages: sorted(messages),
        hiddenFieldMessages: sorted(hiddenFieldMessages),
        options: Object.fromEntries(
            visible
                .filter((field) => metadata.dataElements.get(field.id)?.options)
                .map((field) => [
                    field.id,
                    (field.choices ?? []).map((choice) => choice.value),
                ])
        ),
    }
}

// ---- Capture ----------------------------------------------------------------

interface CaptureMessage {
    /** A stage field id, or `form` for a message without one (Capture's `general`). */
    key: string
    kind: RuleMessage['kind']
    text: string
}

interface CaptureEffects {
    hiddenFields: Set<string>
    hiddenSections: Set<string>
    compulsory: Set<string>
    /** In write order; `null` clears. */
    assignments: Map<string, string | null>
    messages: CaptureMessage[]
    hiddenOptions: Map<string, Set<string>>
    hiddenGroups: Map<string, Set<string>>
    shownGroups: Map<string, Set<string>>
}

const MESSAGE_KINDS = new Map<string, RuleMessage['kind']>([
    ['SHOWERROR', 'error'],
    ['SHOWWARNING', 'warning'],
    ['ERRORONCOMPLETE', 'errorOnComplete'],
    ['WARNINGONCOMPLETE', 'warningOnComplete'],
])

const NUMBER_TYPES = new Set([
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
])

/** `normalizeRuleVariable`, the output converter and the option-set check of `postProcessAssignEffects`. */
const captureAssignedValue = (
    data: string | null | undefined,
    meta: DataElementMeta
): string | null => {
    if (data === null || data === undefined || data === '') {
        return null
    }
    let value: string | null = data
    if (NUMBER_TYPES.has(meta.valueType)) {
        value = Number.isNaN(Number(data)) ? null : String(Number(data))
    } else if (meta.valueType === 'BOOLEAN' || meta.valueType === 'TRUE_ONLY') {
        value = data === 'true' ? 'true' : 'false'
    }
    if (value === null || meta.options === undefined) {
        return value
    }
    const codes = new Set(meta.options.map((option) => option.code))
    const parts = meta.valueType === 'MULTI_TEXT' ? value.split(',') : [value]
    return parts.every((part) => codes.has(part)) ? value : null
}

const addTo = (map: Map<string, Set<string>>, key: string, value: string) => {
    map.set(key, new Set([...(map.get(key) ?? []), value]))
}

const captureEvaluate = (
    scenario: ParityScenario,
    values: Values
): CaptureEffects => {
    const { engine, context, metadata } = scenario
    const built = buildEngineInput(
        engine,
        context,
        withValues(scenario.input, values)
    )
    const raw = context.engine.evaluateEvent(
        built.event,
        built.enrollment,
        built.otherEvents,
        context.engineContext
    )
    const inStage = (id: string | undefined): id is string =>
        id !== undefined && metadata.dataElements.has(id)

    const hideFieldIds: string[] = []
    const assignEffects: [string, string | null][] = []
    const effects: CaptureEffects = {
        hiddenFields: new Set(),
        hiddenSections: new Set(),
        compulsory: new Set(),
        assignments: new Map(),
        messages: [],
        hiddenOptions: new Map(),
        hiddenGroups: new Map(),
        shownGroups: new Map(),
    }
    for (const effect of raw) {
        const values = effect.ruleAction.values
        const actionId = values.get('id')
        const action =
            actionId === undefined
                ? undefined
                : context.actionMetadata.get(actionId)
        if (action === undefined) {
            continue
        }
        // Capture targets the action's data element or attribute, and an ASSIGN the field the
        // engine reports (a `#{var}` ASSIGN reports the variable's data element). The stage scope
        // filter then drops attributes and the data elements of other stages.
        const target =
            action.type === 'ASSIGN'
                ? values.get('attributeType') === 'DATA_ELEMENT'
                    ? values.get('field')
                    : undefined
                : (action.dataElementId ?? action.attributeId)
        const field = inStage(target) ? target : undefined
        const kind = MESSAGE_KINDS.get(action.type)
        if (kind !== undefined) {
            if (target === undefined || field !== undefined) {
                effects.messages.push({
                    key: field ?? 'form',
                    kind,
                    text: `${action.displayContent ?? action.content ?? ''} ${effect.data ?? ''}`,
                })
            }
            continue
        }
        if (action.type === 'HIDESECTION' && action.sectionId !== undefined) {
            effects.hiddenSections.add(action.sectionId)
        }
        if (field === undefined) {
            continue
        }
        const meta = metadata.dataElements.get(field)
        switch (action.type) {
            case 'ASSIGN':
                if (meta !== undefined) {
                    assignEffects.push([
                        field,
                        captureAssignedValue(effect.data, meta),
                    ])
                }
                break
            case 'HIDEFIELD':
                hideFieldIds.push(field)
                break
            case 'SETMANDATORYFIELD':
                effects.compulsory.add(field)
                break
            case 'HIDEOPTION':
                if (action.option !== undefined) {
                    addTo(effects.hiddenOptions, field, action.option.code)
                }
                break
            case 'HIDEOPTIONGROUP':
                if (action.optionGroup !== undefined) {
                    addTo(effects.hiddenGroups, field, action.optionGroup.id)
                }
                break
            case 'SHOWOPTIONGROUP':
                if (action.optionGroup !== undefined) {
                    addTo(effects.shownGroups, field, action.optionGroup.id)
                }
                break
            default:
        }
    }

    const compulsory = (id: string) =>
        metadata.dataElements.get(id)?.compulsory === true ||
        effects.compulsory.has(id)
    const sectionFieldIds = metadata.stage.sections
        .filter((section) => effects.hiddenSections.has(section.id))
        .flatMap((section) => section.dataElementIds)
    for (const id of [...hideFieldIds, ...sectionFieldIds]) {
        if (!compulsory(id)) {
            effects.hiddenFields.add(id)
        }
    }
    // Only HIDEFIELD blanks (not HIDESECTION), compulsory or not; a real ASSIGN wins.
    for (const id of hideFieldIds) {
        effects.assignments.set(id, null)
    }
    for (const [id, value] of assignEffects) {
        effects.assignments.set(id, value)
    }
    return effects
}

const writeAssignments = (values: Values, effects: CaptureEffects): Values => {
    const next = new Map(Object.entries(values))
    for (const [id, value] of effects.assignments) {
        if (value === null || value === '') {
            next.delete(id)
        } else {
            next.set(id, value)
        }
    }
    return Object.fromEntries(next)
}

const sameValues = (a: Values, b: Values) =>
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([id, value]) => b[id] === value)

const captureViewOf = (
    scenario: ParityScenario,
    effects: CaptureEffects,
    values: Values
): FormView => {
    const { metadata, context } = scenario
    const inVisibleSection = new Set(
        metadata.stage.sections
            .filter((section) => !effects.hiddenSections.has(section.id))
            .flatMap((section) => section.dataElementIds)
    )
    const visible = [...metadata.dataElements.keys()].filter(
        (id) => inVisibleSection.has(id) && !effects.hiddenFields.has(id)
    )
    const visibleIds = new Set(visible)
    const isRequired = (id: string) =>
        metadata.dataElements.get(id)?.compulsory === true ||
        effects.compulsory.has(id)
    const messages = effects.messages
        .filter(({ key }) => key === 'form' || visibleIds.has(key))
        .map(({ key, kind, text }) => messageLine(key, kind, text))
    const hiddenFieldMessages = effects.messages
        .filter(
            ({ key, kind }) =>
                key !== 'form' &&
                !visibleIds.has(key) &&
                // A rendered section validates its hidden fields' errors.
                ((kind === 'error' && inVisibleSection.has(key)) ||
                    // The completion dialog lists every field's.
                    kind === 'errorOnComplete' ||
                    kind === 'warningOnComplete')
        )
        .map(({ key, kind, text }) => messageLine(key, kind, text))
    const codesOf = (groups: Set<string> | undefined) =>
        groups === undefined || groups.size === 0
            ? undefined
            : new Set(
                  [...groups].flatMap((group) => [
                      ...(context.optionGroupOptions.get(group) ?? []),
                  ])
              )
    const options = Object.fromEntries(
        visible.flatMap((id) => {
            const all = metadata.dataElements.get(id)?.options
            if (all === undefined) {
                return []
            }
            const shown = codesOf(effects.shownGroups.get(id))
            const hiddenByGroup = codesOf(effects.hiddenGroups.get(id))
            const hidden = effects.hiddenOptions.get(id)
            return [
                [
                    id,
                    all
                        .map((option) => option.code)
                        .filter(
                            (code) =>
                                (shown === undefined || shown.has(code)) &&
                                !hiddenByGroup?.has(code) &&
                                !hidden?.has(code)
                        ),
                ],
            ]
        })
    )
    return {
        visible: sorted(visible),
        values: { ...values },
        required: sorted(visible.filter(isRequired)),
        messages: sorted(messages),
        hiddenFieldMessages: sorted(hiddenFieldMessages),
        options,
    }
}

/** One Capture rules run on `values`: what it shows right after the change, and what it then holds. */
export const captureFirstRun = (
    scenario: ParityScenario,
    values: Values
): FormView => {
    const effects = captureEvaluate(scenario, values)
    return captureViewOf(scenario, effects, writeAssignments(values, effects))
}

const MAX_RUNS = 10

/**
 * Capture's runs repeated until one writes nothing new, so the effects shown were computed from
 * the values shown. Throws if the runs never settle.
 */
export const captureSettled = (
    scenario: ParityScenario,
    values: Values
): FormView => {
    let current = values
    for (let run = 0; run < MAX_RUNS; run += 1) {
        const effects = captureEvaluate(scenario, current)
        const next = writeAssignments(current, effects)
        if (sameValues(current, next)) {
            return captureViewOf(scenario, effects, current)
        }
        current = next
    }
    throw new Error(`Capture did not settle in ${MAX_RUNS} runs`)
}
