import { createContext, useContext } from 'react'
import type { EventFormValue } from '../hooks/useEventForm'
import type { FormState } from '../lib/formState'

/** Internal: the parts read their form through it. */
export const EventFormContext = createContext<EventFormValue | null>(null)

export const useEventFormContext = (): EventFormValue => {
    const context = useContext(EventFormContext)
    if (!context) {
        throw new Error('Event form parts must be rendered inside EventForm')
    }
    return context
}

/** The last attempt's result while it blocked, until the next attempt or a save. */
export const failedAttempt = ({ summary }: FormState) =>
    summary !== undefined &&
    (summary.invalid.length > 0 || summary.formErrors.length > 0)
        ? summary
        : undefined
