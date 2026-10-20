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
                {/* Flex, not a fixed grid: the nav renders nothing for a stage with fewer
                    than two visible sections, and the sections must then fill the row. */}
                <div className="flex flex-col gap-6 md:flex-row md:items-start">
                    <EventFormSectionNav className="md:w-50 md:shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                        <EventFormSections />
                        <EventFormNotes />
                    </div>
                </div>
                <EventFormActions />
            </div>
        </EventForm>
    )
}
