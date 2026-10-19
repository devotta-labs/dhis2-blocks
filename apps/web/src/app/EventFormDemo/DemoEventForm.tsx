import {
    EventForm,
    EventFormActions,
    EventFormDetails,
    EventFormFeedback,
    EventFormNotes,
    EventFormSectionNav,
    EventFormSections,
    type EventFormSavedResult,
} from '@dhis2-blocks/event-form'
import { ErrorAlert } from '@dhis2-blocks/ui/alert'
import { Spinner } from '@dhis2-blocks/ui/spinner'
import React from 'react'
import type { createAppWorkingListClient } from '../AppShell/createAppWorkingListClient'
import i18n from '../../i18n'
import { useEnrollment } from './useEventFormDemoData'

interface DemoEventFormProps {
    client: ReturnType<typeof createAppWorkingListClient>
    programId: string
    programStageId: string
    enrollmentId: string
    orgUnitId: string
    /** Omit to create a new event. */
    eventId?: string
    onSaved: (result: EventFormSavedResult) => void
    onCancel: () => void
}

/**
 * The Event Form composed with every part. The host owns the layout: details on top, then the
 * section navigation beside the sections and notes, and the actions at the bottom.
 */
export const DemoEventForm = ({
    client,
    enrollmentId,
    ...formProps
}: DemoEventFormProps) => {
    const enrollment = useEnrollment(client, enrollmentId)

    if (enrollment.isPending) {
        return <Spinner aria-label={i18n.t('Loading')} />
    }
    if (enrollment.error) {
        return (
            <ErrorAlert title={i18n.t('Could not load the enrollment')}>
                {enrollment.error.message}
            </ErrorAlert>
        )
    }
    return (
        <EventForm
            {...formProps}
            enrollmentId={enrollmentId}
            trackedEntityId={enrollment.data.trackedEntity}
        >
            <div className="flex flex-col gap-4">
                <EventFormDetails />
                <EventFormFeedback />
                <div className="grid items-start gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
                    <EventFormSectionNav />
                    <div className="flex flex-col gap-4">
                        <EventFormSections />
                        <EventFormNotes />
                    </div>
                </div>
                <EventFormActions />
            </div>
        </EventForm>
    )
}
