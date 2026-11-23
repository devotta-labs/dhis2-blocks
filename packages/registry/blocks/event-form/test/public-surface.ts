import { createElement } from 'react'
import type { EventFormProps, EventFormSaved } from '../index'
import {
    EventForm,
    EventFormActions,
    EventFormFeedback,
    EventFormFields,
    EventFormNotes,
} from '../index'

export type SupportedEventFormTypes = [EventFormProps, EventFormSaved]

export const form = (props: EventFormProps) =>
    createElement(
        EventForm,
        props,
        createElement(EventFormFields),
        createElement(EventFormFeedback),
        createElement(EventFormNotes),
        createElement(EventFormActions)
    )
export const quietForm = (
    props: EventFormProps,
    onUnsavedRuleChanges: (count: number) => void
) =>
    createElement(EventForm, {
        ...props,
        blame: 'off',
        confirmSaved: 'off',
        locationWarnKm: 25,
        onUnsavedRuleChanges,
    })
