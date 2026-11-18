import { createElement } from 'react'
import type { ReactNode } from 'react'
import type { EventFormProps, EventFormSaved } from '../index'
import {
    EventForm,
    EventFormActions,
    EventFormFeedback,
    EventFormFields,
    EventFormNotes,
} from '../index'

export type SupportedEventFormTypes = [EventFormProps, EventFormSaved]

// Every export, used as an app would use it.
export const form = (props: EventFormProps): ReactNode =>
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
): ReactNode =>
    createElement(EventForm, {
        ...props,
        blame: 'off',
        confirmSaved: 'off',
        locationWarnKm: 25,
        onUnsavedRuleChanges,
    })
