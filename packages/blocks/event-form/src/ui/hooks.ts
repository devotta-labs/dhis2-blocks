import {
    useEventFormInternal,
    useEventFormPublic,
    useEventFormRulesContext,
    type EventFormCommands,
    type EventFormRules,
    type EventFormState,
} from './EventForm/EventFormContext'

/** Values, dirty flag, status, validation and save state of the enclosing `EventForm`. */
export const useEventFormState = (): EventFormState =>
    useEventFormPublic('useEventFormState').state

/** Save, complete, cancel and reset the enclosing `EventForm`. The functions are stable. */
export const useEventFormActions = (): EventFormCommands =>
    useEventFormInternal('useEventFormActions').actions

/** Rule effects and explanations: which rules touched a field, and why. */
export const useEventFormRules = (): EventFormRules =>
    useEventFormRulesContext('useEventFormRules')
