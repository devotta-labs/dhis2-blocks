import {
    EventForm,
    EventFormActions,
    EventFormFeedback,
    EventFormFields,
    EventFormNotes,
    type EventFormSaved,
} from '@/components/event-form'

interface Props {
    programId: string
    programStageId: string
    orgUnitId: string
    eventId?: string
    enrollmentId?: string
    trackedEntityId?: string
    blame: 'markers' | 'off'
    confirmSaved: 'status' | 'off'
    locationWarnKm?: number
    onSaved: (saved: EventFormSaved) => void
    onDirtyChange: (dirty: boolean) => void
    onUnsavedRuleChanges: (count: number) => void
}

/** The README's composition: the fields, what the rules say of the whole form, the notes and the actions. */
export const EventFormCanvas = ({
    programId,
    programStageId,
    orgUnitId,
    eventId,
    enrollmentId,
    trackedEntityId,
    blame,
    confirmSaved,
    locationWarnKm,
    onSaved,
    onDirtyChange,
    onUnsavedRuleChanges,
}: Props) => (
    <div className="w-full min-w-0 rounded-lg bg-dhis2-background p-4">
        <EventForm
            programId={programId}
            programStageId={programStageId}
            orgUnitId={orgUnitId}
            eventId={eventId}
            enrollmentId={enrollmentId}
            trackedEntityId={trackedEntityId}
            blame={blame}
            confirmSaved={confirmSaved}
            locationWarnKm={locationWarnKm}
            onSaved={onSaved}
            onDirtyChange={onDirtyChange}
            onUnsavedRuleChanges={onUnsavedRuleChanges}
        >
            <EventFormFields />
            <EventFormFeedback />
            <EventFormNotes />
            <EventFormActions />
        </EventForm>
    </div>
)
