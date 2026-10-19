import type {
    Attribution,
    RuleEffects,
    RuleMessage,
} from '@/registry/program-rules/index'
import type { DataElementMeta, StageMetadata } from '../api/schemas'
import type { Values } from './overlay'
import {
    answerChoices,
    getValueTypeSpec,
    type AnswerChoice,
    type InputMode,
    type ValueError,
    type WidgetKind,
} from './valueTypes'

export interface FieldModel {
    id: string
    label: string
    description?: string
    kind: WidgetKind
    inputMode?: InputMode
    /** The effective value; absent when empty. */
    value?: string
    /** Present for choice, select and multiSelect kinds. */
    choices?: AnswerChoice[]
    /** Not editable: calculated by a rule, or an unsupported value type. */
    disabled: boolean
    /** Set when a rule assigns this field's value. */
    assignedBy?: Attribution
    /** Required by the stage metadata or by a rule. */
    required: boolean
    /** Required, empty and errors are being shown (show-all or completing). */
    requiredMissing: boolean
    /** Hidden by a rule (or its section is), or in no section. Hidden fields are never validated. */
    hidden: boolean
    /** Strings are untranslated keys or rule-provided text; the UI translates them. */
    messages: {
        /** The value-type validation error. */
        error?: string
        warning?: string
        errorOnComplete?: string
        warningOnComplete?: string
        /** Every rule message of kind `error`; the other kinds are the strings above. */
        ruleErrors: RuleMessage[]
    }
    unsupported: boolean
}

export interface SectionModel {
    id: string
    name: string
    hidden: boolean
    /** Visible fields only. */
    fieldIds: string[]
}

export interface FormModel {
    sections: SectionModel[]
    fields: Map<string, FieldModel>
}

export interface BuildFormModelInput {
    metadata: StageMetadata
    /** Stored values with rule effects applied, see `overlay`. */
    effective: Values
    stored: Values
    effects: RuleEffects | undefined
    /** optionGroupId → option codes; `RuleEffects.optionGroups` holds group ids. */
    optionGroupOptions: ReadonlyMap<string, ReadonlySet<string>>
    /** Value-type validation errors by field id. */
    fieldErrors: Readonly<Record<string, ValueError>>
    showAllErrors: boolean
    isCompleting: boolean
}

const CHOICE_KINDS: ReadonlySet<WidgetKind> = new Set([
    'choice',
    'select',
    'multiSelect',
])

const codesOfGroups = (
    groupIds: ReadonlySet<string>,
    optionGroupOptions: BuildFormModelInput['optionGroupOptions']
): Set<string> => {
    const codes = new Set<string>()
    for (const groupId of groupIds) {
        for (const code of optionGroupOptions.get(groupId) ?? []) {
            codes.add(code)
        }
    }
    return codes
}

/**
 * The options a rule leaves available. Shown option groups restrict the field to the union of
 * their options; hidden groups and hidden options are then removed.
 */
const ruleFilteredChoices = (
    id: string,
    all: AnswerChoice[],
    effects: RuleEffects | undefined,
    optionGroupOptions: BuildFormModelInput['optionGroupOptions']
): AnswerChoice[] => {
    const hiddenOptions = effects?.hiddenOptions.get(id)
    const groups = effects?.optionGroups.get(id)
    if (hiddenOptions === undefined && groups === undefined) {
        return all
    }
    const shown =
        groups !== undefined && groups.shown.size > 0
            ? codesOfGroups(groups.shown, optionGroupOptions)
            : undefined
    const hiddenByGroup =
        groups !== undefined && groups.hidden.size > 0
            ? codesOfGroups(groups.hidden, optionGroupOptions)
            : undefined
    return all.filter(
        ({ value }) =>
            (shown === undefined || shown.has(value)) &&
            !hiddenByGroup?.has(value) &&
            !hiddenOptions?.has(value)
    )
}

const valueCodes = (kind: WidgetKind, value: string): string[] =>
    kind === 'multiSelect' ? value.split(',') : [value]

/**
 * Choices for a field. A value the user cannot pick any more (a retired option on an existing
 * event, or one a rule hid after it was chosen) stays in the list, so the field never shows blank
 * while the event still holds that value. It is not an error.
 */
const choicesOf = (
    meta: DataElementMeta,
    kind: WidgetKind,
    value: string | undefined,
    effects: RuleEffects | undefined,
    optionGroupOptions: BuildFormModelInput['optionGroupOptions']
): AnswerChoice[] => {
    const all = answerChoices(meta)
    const choices = ruleFilteredChoices(
        meta.id,
        all,
        effects,
        optionGroupOptions
    )
    if (value === undefined) {
        return choices
    }
    const missing = valueCodes(kind, value).filter(
        (code) =>
            code !== '' && !choices.some((choice) => choice.value === code)
    )
    if (missing.length === 0) {
        return choices
    }
    return [
        ...choices,
        ...missing.map(
            (code) =>
                all.find((choice) => choice.value === code) ?? {
                    value: code,
                    label: code,
                }
        ),
    ]
}

const messagesOf = (
    id: string,
    effects: RuleEffects | undefined,
    error: ValueError | undefined
): FieldModel['messages'] => {
    const ruleMessages = effects?.messages.get(id) ?? []
    const firstText = (kind: RuleMessage['kind']): string | undefined =>
        ruleMessages.find((message) => message.kind === kind)?.text
    const warning = firstText('warning')
    const errorOnComplete = firstText('errorOnComplete')
    const warningOnComplete = firstText('warningOnComplete')
    return {
        ...(error !== undefined && { error: error.message }),
        ...(warning !== undefined && { warning }),
        ...(errorOnComplete !== undefined && { errorOnComplete }),
        ...(warningOnComplete !== undefined && { warningOnComplete }),
        ruleErrors: ruleMessages.filter((message) => message.kind === 'error'),
    }
}

const buildField = (
    meta: DataElementMeta,
    hidden: boolean,
    input: BuildFormModelInput
): FieldModel => {
    const { effects, effective, optionGroupOptions } = input
    const spec = getValueTypeSpec(meta)
    const unsupported = spec.kind === 'unsupported'
    const value = effective[meta.id] === '' ? undefined : effective[meta.id]
    const assignedBy = hidden
        ? undefined
        : effects?.assignedValues.get(meta.id)?.by
    const required =
        meta.compulsory || (effects?.mandatoryFields.has(meta.id) ?? false)
    return {
        id: meta.id,
        label: meta.label,
        ...(meta.description !== undefined && {
            description: meta.description,
        }),
        kind: spec.kind,
        ...(spec.inputMode !== undefined && { inputMode: spec.inputMode }),
        ...(value !== undefined && { value }),
        ...(CHOICE_KINDS.has(spec.kind) && {
            choices: choicesOf(
                meta,
                spec.kind,
                value,
                effects,
                optionGroupOptions
            ),
        }),
        disabled: unsupported || assignedBy !== undefined,
        ...(assignedBy !== undefined && { assignedBy }),
        required,
        requiredMissing:
            !hidden &&
            required &&
            value === undefined &&
            (input.showAllErrors || input.isCompleting),
        hidden,
        messages: hidden
            ? { ruleErrors: [] }
            : messagesOf(meta.id, effects, input.fieldErrors[meta.id]),
        unsupported,
    }
}

const sameStrings = (a: readonly string[], b: readonly string[]): boolean =>
    a.length === b.length && a.every((item, index) => item === b[index])

const sameAttribution = (
    a: Attribution | undefined,
    b: Attribution | undefined
): boolean =>
    a === b ||
    (a !== undefined &&
        b !== undefined &&
        a.ruleId === b.ruleId &&
        a.ruleName === b.ruleName &&
        a.actionId === b.actionId &&
        a.condition === b.condition &&
        sameStrings(a.readsFields, b.readsFields))

const sameRuleMessages = (
    a: readonly RuleMessage[],
    b: readonly RuleMessage[]
): boolean =>
    a.length === b.length &&
    a.every(
        (message, index) =>
            message.kind === b[index].kind &&
            message.text === b[index].text &&
            sameAttribution(message.by, b[index].by)
    )

const sameChoices = (
    a: readonly AnswerChoice[] | undefined,
    b: readonly AnswerChoice[] | undefined
): boolean =>
    a === b ||
    (a !== undefined &&
        b !== undefined &&
        a.length === b.length &&
        a.every(
            (choice, index) =>
                choice.value === b[index].value &&
                choice.label === b[index].label
        ))

/*
 * Content equality, field by field. Rule effects are rebuilt on every evaluation and metadata maps
 * get new identities on refetch, so identity cannot tell whether a field changed. Every FieldModel
 * property must be compared here, so extend this when FieldModel grows.
 */
const sameField = (a: FieldModel, b: FieldModel): boolean =>
    a.id === b.id &&
    a.label === b.label &&
    a.description === b.description &&
    a.kind === b.kind &&
    a.inputMode === b.inputMode &&
    a.value === b.value &&
    sameChoices(a.choices, b.choices) &&
    a.disabled === b.disabled &&
    sameAttribution(a.assignedBy, b.assignedBy) &&
    a.required === b.required &&
    a.requiredMissing === b.requiredMissing &&
    a.hidden === b.hidden &&
    a.unsupported === b.unsupported &&
    a.messages.error === b.messages.error &&
    a.messages.warning === b.messages.warning &&
    a.messages.errorOnComplete === b.messages.errorOnComplete &&
    a.messages.warningOnComplete === b.messages.warningOnComplete &&
    sameRuleMessages(a.messages.ruleErrors, b.messages.ruleErrors)

const sameSection = (a: SectionModel, b: SectionModel): boolean =>
    a.id === b.id &&
    a.name === b.name &&
    a.hidden === b.hidden &&
    sameStrings(a.fieldIds, b.fieldIds)

/** Reuses the previous object when the new one has equal content. */
const shared = <T>(
    previous: T | undefined,
    next: T,
    same: (a: T, b: T) => boolean
): T => (previous !== undefined && same(previous, next) ? previous : next)

/**
 * Derives what the form renders from metadata, effective values and rule effects. A field or
 * section whose content equals the previous build is returned as the same object, so unchanged
 * fields do not re-render. Inputs are compared by content: a refetch that returns identical
 * metadata (a new Map, new arrays) keeps every model.
 */
export const buildFormModel = (
    prev: FormModel | undefined,
    input: BuildFormModelInput
): FormModel => {
    const { metadata, effects } = input

    const hiddenSections = new Set<string>()
    const inVisibleSection = new Set<string>()
    for (const section of metadata.stage.sections) {
        if (effects?.hiddenSections.has(section.id)) {
            hiddenSections.add(section.id)
        } else {
            section.dataElementIds.forEach((id) => inVisibleSection.add(id))
        }
    }

    const fields = new Map<string, FieldModel>()
    for (const [id, meta] of metadata.dataElements) {
        const hidden =
            (effects?.hiddenFields.has(id) ?? false) ||
            !inVisibleSection.has(id)
        fields.set(
            id,
            shared(
                prev?.fields.get(id),
                buildField(meta, hidden, input),
                sameField
            )
        )
    }

    const previousSections = new Map(
        prev?.sections.map((section) => [section.id, section])
    )
    const sections = metadata.stage.sections.map((section) => {
        const hidden = hiddenSections.has(section.id)
        const next: SectionModel = {
            id: section.id,
            name: section.name,
            hidden,
            fieldIds: hidden
                ? []
                : section.dataElementIds.filter(
                      (id) => fields.get(id)?.hidden === false
                  ),
        }
        return shared(previousSections.get(section.id), next, sameSection)
    })

    if (prev !== undefined && isSameModel(prev, sections, fields)) {
        return prev
    }
    return { sections, fields }
}

const isSameModel = (
    prev: FormModel,
    sections: SectionModel[],
    fields: Map<string, FieldModel>
): boolean => {
    if (
        prev.sections.length !== sections.length ||
        prev.fields.size !== fields.size ||
        prev.sections.some((section, index) => section !== sections[index])
    ) {
        return false
    }
    const previousFields = prev.fields.entries()
    for (const [id, field] of fields) {
        const [previousId, previousField] = previousFields.next().value ?? []
        if (previousId !== id || previousField !== field) {
            return false
        }
    }
    return true
}
