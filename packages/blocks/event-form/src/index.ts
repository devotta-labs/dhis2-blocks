/** Public entry point for the installed Event Form block. */
export {
    EventForm,
    type EventFormProps,
    type EventFormSavedResult,
} from './ui/EventForm/EventForm'
export type {
    EventFormCommands,
    EventFormReadOnlyReason,
    EventFormRules,
    EventFormState,
} from './ui/EventForm/EventFormContext'
export { EventFormActions } from './ui/EventFormActions'
export { EventFormDetails } from './ui/EventFormDetails'
export { EventFormFeedback } from './ui/EventFormFeedback'
export { EventFormField } from './ui/EventFormField'
export { EventFormNotes } from './ui/EventFormNotes'
export {
    EventFormSection,
    type EventFormFieldWrapperProps,
    type EventFormHiddenSectionProps,
    type EventFormSectionProps,
    type EventFormSectionSlots,
} from './ui/EventFormSection'
export { EventFormSectionNav } from './ui/EventFormSectionNav'
export { EventFormSections } from './ui/EventFormSections'
export {
    EventFormTextProvider,
    type EventFormTranslate,
} from './ui/EventFormText'
export {
    useEventFormActions,
    useEventFormRules,
    useEventFormState,
} from './ui/hooks'

export {
    createEventFormClient,
    type DataEngineLike,
    type EventFormClient,
} from './api/client'
export { useEventFormClient } from './api/runtimeClient'
export { canUseEventForm } from './model/capability'
export type { RuleChange, Values } from './model/overlay'
export type { EventPayload } from './save/payload'
export {
    eventFormMutationKeys,
    registerEventFormMutations,
} from './save/useSaveEvent'
export {
    createOnlineEventWriter,
    type EventWriter,
    type SaveError,
    type SaveOutcome,
} from './save/writer'
export type { EventStatus } from './state/store'
