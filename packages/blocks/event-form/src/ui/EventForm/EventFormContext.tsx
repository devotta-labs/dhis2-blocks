import { createContext, useContext, useSyncExternalStore } from 'react'
import type {
    Attribution,
    InvalidRule,
    RuleMessage,
    RuleDependencyGraph,
    RuleEffects,
} from '@/registry/program-rules/index'
import type { ProgramRulesStatus } from '@/registry/program-rules/use-program-rules'
import type { SystemCalendar, TrackerEvent } from '../../api/schemas'
import type {
    FieldModel,
    FormModel,
    SectionModel,
} from '../../model/buildFormModel'
import type { RuleChange, Values } from '../../model/overlay'
import type { SaveError } from '../../save/writer'
import type {
    EventContext,
    EventFormStore,
    EventStatus,
} from '../../state/store'

/**
 * Where fields and sections read their models from. Each one subscribes to its own entry, so a
 * commit that changes one field's model re-renders that field and no other: `buildFormModel`
 * returns the same object for a field or section whose content did not change.
 */
interface FormModelSource {
    getField(id: string): FieldModel | undefined
    getSection(id: string): SectionModel | undefined
    getSections(): readonly SectionModel[]
    subscribe(listener: () => void): () => void
}

export interface MutableFormModelSource extends FormModelSource {
    setModel(model: FormModel): void
}

export const createFormModelSource = (
    initial: FormModel
): MutableFormModelSource => {
    let model = initial
    let sectionsById = new Map(
        initial.sections.map((section) => [section.id, section])
    )
    const listeners = new Set<() => void>()
    return {
        getField: (id) => model.fields.get(id),
        getSection: (id) => sectionsById.get(id),
        getSections: () => model.sections,
        subscribe: (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        setModel: (next) => {
            if (next === model) {
                return
            }
            if (next.sections !== model.sections) {
                sectionsById = new Map(
                    next.sections.map((section) => [section.id, section])
                )
            }
            model = next
            listeners.forEach((listener) => listener())
        },
    }
}

export interface EventFormFieldContextValue {
    source: FormModelSource
    /** Stores a field's value in tracker API format; `undefined` clears it. */
    commit(id: string, value: string | undefined): void
    /** The instance's calendar, for date fields. */
    calendar: SystemCalendar
    /** The form is read-only (a skipped or locked event): every field is disabled. */
    readOnly: boolean
    /** Organisation unit ids the organisation unit picker starts its tree from. */
    orgUnitRoots: readonly string[]
}

export const EventFormFieldContext =
    createContext<EventFormFieldContextValue | null>(null)

export const useEventFormFieldContext = (): EventFormFieldContextValue => {
    const context = useContext(EventFormFieldContext)
    if (context === null) {
        throw new Error('EventFormField must be rendered inside an EventForm')
    }
    return context
}

export const useFieldModel = (id: string): FieldModel | undefined => {
    const { source } = useEventFormFieldContext()
    return useSyncExternalStore(
        source.subscribe,
        () => source.getField(id),
        () => source.getField(id)
    )
}

export const useSectionModel = (id: string): SectionModel | undefined => {
    const { source } = useEventFormFieldContext()
    return useSyncExternalStore(
        source.subscribe,
        () => source.getSection(id),
        () => source.getSection(id)
    )
}

export const useSectionModels = (): readonly SectionModel[] => {
    const { source } = useEventFormFieldContext()
    return useSyncExternalStore(
        source.subscribe,
        source.getSections,
        source.getSections
    )
}

/** Why the form cannot be edited. */
export type EventFormReadOnlyReason =
    | 'skipped'
    | 'completed'
    | 'rulesLoading'
    | 'rulesFailed'

/** What a host can read about the form. Values are the effective ones: what Save sends. */
export interface EventFormState {
    eventId: string
    /** Not saved yet. A new event is an edit once its first save succeeds. */
    isNew: boolean
    status: EventStatus
    values: Values
    /** Changed since it was opened or last saved. Rule effects never count. */
    dirty: boolean
    readOnly: boolean
    readOnlyReason?: EventFormReadOnlyReason
    /** The furthest action tried since the form opened or was saved; errors show once one was. */
    attempt: 'none' | 'save' | 'complete'
    saving: boolean
    /** Validation for the action last attempted (Save, unless Complete was tried). */
    validation: {
        isValid: boolean
        failedFieldIds: string[]
        /** Rule errors about the whole event that block the action. */
        formErrors: RuleMessage[]
    }
    /** Why the last save failed; cleared by the next attempt. */
    saveError?: SaveError
}

export interface EventFormRules {
    status: ProgramRulesStatus
    effects?: RuleEffects
    /** Stored values the rules clear or change; they are sent that way on save. */
    ruleChanges: readonly RuleChange[]
    invalidRules: readonly InvalidRule[]
    /** The rule actions that touched a field. */
    explain(fieldId: string): Attribution[]
    graph?: RuleDependencyGraph
    error?: Error
}

export interface EventFormCommands {
    /** Validates as a save and posts the event. Focuses the first field that blocks it. */
    save(): Promise<void>
    /** Validates as completing and posts the event as COMPLETED; asks first when rules warn. */
    complete(): Promise<void>
    /** Calls `onCancel`, after asking when there are unsaved changes. */
    cancel(): void
    /** Back to the state the form was opened (or last saved) in. */
    reset(): void
}

interface EventFormPublicValue {
    model: FormModel
    state: EventFormState
}

/** Public: changes whenever the model or state does. */
export const EventFormStateContext = createContext<EventFormPublicValue | null>(
    null
)

export const EventFormRulesContext = createContext<EventFormRules | null>(null)

/** Context fields: what `EventFormDetails` edits. */
interface EventFormStage {
    name: string
    executionDateLabel?: string
    featureType: 'NONE' | 'POINT' | 'POLYGON'
}

/** Private: the store and the commands, for this block's own parts. */
export interface EventFormInternalValue {
    store: EventFormStore
    actions: EventFormCommands
    /** Stores a context field with the same semantics as a value commit; `undefined` clears it. */
    commitContext(field: keyof EventContext, value: string | undefined): void
    /** The DOM id of a section's heading in this form instance. */
    sectionHeadingId(sectionId: string): string
    stage: EventFormStage
    /** Notes already on the event, as loaded. */
    notes: TrackerEvent['notes']
}

export const EventFormInternalContext =
    createContext<EventFormInternalValue | null>(null)

const required = <T,>(value: T | null, name: string): T => {
    if (value === null) {
        throw new Error(`${name} must be used inside an EventForm`)
    }
    return value
}

export const useEventFormPublic = (name: string): EventFormPublicValue =>
    required(useContext(EventFormStateContext), name)

export const useEventFormInternal = (name: string): EventFormInternalValue =>
    required(useContext(EventFormInternalContext), name)

export const useEventFormRulesContext = (name: string): EventFormRules =>
    required(useContext(EventFormRulesContext), name)
