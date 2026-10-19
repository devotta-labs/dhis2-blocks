import React, { type ReactNode } from 'react'
import { ErrorAlert } from '@/registry/dhis2/ui/alert'
import { Spinner } from '@/registry/dhis2/ui/spinner'
import {
    useCaptureOrgUnits,
    useStageMetadata,
    useSystemCalendar,
    useTrackerEvent,
} from '../../api/hooks'
import { canUseEventForm } from '../../model/capability'
import type { SaveOutcome } from '../../save/writer'
import type { EventWriter } from '../../save/writer'
import { useEventFormText } from '../EventFormText'
import { EventFormProvider } from './EventFormProvider'

export interface EventFormSavedResult {
    eventId: string
    /** `queued` when the writer stored the event to send later: it is not on the server yet. */
    outcome: SaveOutcome
}

export interface EventFormProps {
    programId: string
    programStageId: string
    enrollmentId: string
    /** The org unit of a new event. An existing event keeps its own. */
    orgUnitId: string
    /** Omit to create a new event. */
    eventId?: string
    trackedEntityId?: string
    /** Saves the event; posts it to `/tracker` when omitted (unless the host registered a writer). */
    writer?: EventWriter
    onSaved(result: EventFormSavedResult): void
    onCancel(): void
    children: ReactNode
    className?: string
}

/**
 * Create or edit one tracker event of a program stage, with its program rules applied. Loads the
 * stage, the event and the calendar, then opens the form. The parts (`EventFormDetails`,
 * `EventFormSections`, `EventFormActions`, …) go in `children`, laid out as the host likes. Needs
 * the DHIS2 app-runtime provider and a React Query `QueryClientProvider` above it.
 */
export const EventForm = (props: EventFormProps) => {
    const { programId, programStageId, eventId, className } = props
    const translate = useEventFormText()
    const stage = useStageMetadata(programId, programStageId)
    const event = useTrackerEvent(eventId)
    const calendar = useSystemCalendar()
    const roots = useCaptureOrgUnits()

    // A failed background refetch keeps the form open on the data it has.
    const error =
        (stage.data === undefined ? stage.error : null) ??
        (eventId !== undefined && event.data === undefined
            ? event.error
            : null) ??
        (calendar.data === undefined ? calendar.error : null) ??
        (roots.data === undefined ? roots.error : null)
    if (error) {
        return (
            <div className={className}>
                <ErrorAlert title={translate('The event could not be loaded')}>
                    {error.message}
                </ErrorAlert>
            </div>
        )
    }
    if (
        stage.data === undefined ||
        (eventId !== undefined && event.data === undefined) ||
        calendar.data === undefined ||
        roots.data === undefined
    ) {
        return (
            <div className={className}>
                <Spinner aria-label={translate('Loading')} />
            </div>
        )
    }
    if (!canUseEventForm(stage.data).ok) {
        return (
            <div className={className}>
                <ErrorAlert
                    title={translate(
                        'This program stage cannot be captured with this form'
                    )}
                />
            </div>
        )
    }
    return (
        <EventFormProvider
            key={`${programId}/${programStageId}/${eventId ?? 'new'}`}
            {...props}
            metadata={stage.data}
            event={event.data}
            calendar={calendar.data}
            orgUnitRoots={roots.data}
        />
    )
}
