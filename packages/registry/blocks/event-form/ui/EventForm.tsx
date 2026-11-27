import i18n from '@dhis2/d2-i18n'
import { useMemo } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { cn } from '@/components/dhis2/ui/cn'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import { useProgramRuleContext } from '@/components/program-rules'
import type { RuleEventStatus } from '@/components/program-rules'
import { useEventForm } from '../hooks/useEventForm'
import { useEventFormData } from '../hooks/useEventFormData'
import type { EventFormData } from '../hooks/useEventFormData'
import { useFocusMovesOn } from '../hooks/useFocusMovesOn'
import { EVENT_DATE, LOCATION } from '../lib/validate'
import { EventFormContext } from './context'
import { EventFormActions } from './EventFormActions'
import { EventFormFeedback } from './EventFormFeedback'
import { EventFormFields } from './EventFormFields'
import { EventFormNotes } from './EventFormNotes'

export interface EventFormSaved {
    eventId: string
    status: RuleEventStatus
}

export interface EventFormProps {
    programId: string
    programStageId: string
    /** The org unit of a new event; an edit keeps the event's own. */
    orgUnitId: string
    /** The event to edit; without it the form creates one. */
    eventId?: string
    enrollmentId?: string
    trackedEntityId?: string
    /**
     * Whether the form says which rule changed what (`'markers'`, the default): a marker beside the label of each field a
     * rule set, made required or gave fewer options, and a list of the questions rules hid, each opening why. With
     * `'off'` the rules apply the same and the form says nothing of them.
     */
    blame?: 'markers' | 'off'
    /** How the form says a save succeeded: a short `Saved` by the buttons (`'status'`), or not at all (`'off'`), for a host that confirms its own way. */
    confirmSaved?: 'status' | 'off'
    onSaved?(saved: EventFormSaved): void
    /** Called when the form gains or loses unsaved changes. */
    onDirtyChange?(dirty: boolean): void
    /**
     * Called when the number of answers the rules alone changed since DHIS2 last saved the event changes, such as a
     * stored value a rule now sets otherwise or hides: 0 once there are none, or once the user changes anything.
     */
    onUnsavedRuleChanges?(count: number): void
    /**
     * How far a point may be from a point org unit, in kilometres, before the form warns that latitude and longitude
     * may be swapped. Without it the distance is said with no warning; a point is never held back for being far.
     */
    locationWarnKm?: number
    className?: string
    /** The parts, placed; without them the fields, the feedback, the notes and the actions. */
    children?: ReactNode
}

type Ready = Extract<EventFormData, { status: 'ready' }>

const FormSkeleton = ({ className }: { className?: string }) => (
    <div
        role="status"
        className={cn('flex max-w-2xl flex-col gap-4', className)}
    >
        <span className="sr-only">{i18n.t('Loading the form')}</span>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
    </div>
)

const ReadyForm = ({ props, data }: { props: EventFormProps; data: Ready }) => {
    const value = useEventForm(props, data)
    const { submit, form, formId } = value
    const controlIds = useMemo(
        () =>
            [
                EVENT_DATE,
                ...form.categories.map(({ id }) => id),
                ...(form.featureType === 'NONE' ? [] : [LOCATION]),
                ...form.sections.flatMap(({ fieldIds }) => fieldIds),
            ].map((fieldId) => `${formId}-${fieldId}`),
        [form, formId]
    )
    const focus = useFocusMovesOn(controlIds)
    if (value.rules.status === 'loading') {
        return <FormSkeleton className={props.className} />
    }
    return (
        <EventFormContext.Provider value={value}>
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Enter from the fields inside, which are the controls */}
            <form
                ref={focus.ref}
                onFocus={focus.onFocus}
                onBlur={focus.onBlur}
                noValidate
                aria-busy={value.state.saving !== undefined}
                className={cn('flex max-w-2xl flex-col gap-6', props.className)}
                onSubmit={(event: FormEvent) => {
                    event.preventDefault()
                    submit('save')
                }}
                onKeyDown={(event: KeyboardEvent) => {
                    if (
                        event.key === 'Enter' &&
                        event.target instanceof HTMLInputElement
                    ) {
                        event.preventDefault()
                    }
                }}
            >
                {props.children ?? (
                    <>
                        <EventFormFields />
                        <EventFormFeedback />
                        <EventFormNotes />
                        <EventFormActions />
                    </>
                )}
            </form>
        </EventFormContext.Provider>
    )
}

const EventFormRoot = (props: EventFormProps) => {
    const data = useEventFormData(
        props.programId,
        props.programStageId,
        props.eventId,
        props.orgUnitId
    )
    useProgramRuleContext({
        programId: props.programId,
        programStageId: props.programStageId,
    })
    if (data.status === 'loading') {
        return <FormSkeleton className={props.className} />
    }
    if (data.status === 'error') {
        return (
            <ErrorAlert
                title={i18n.t('The form could not be loaded')}
                className={props.className}
            >
                {data.error.message}
            </ErrorAlert>
        )
    }
    return <ReadyForm props={props} data={data} />
}

/** Enters or edits one event of a program stage, with the stage's program rules applied, and saves it. */
export const EventForm = (props: EventFormProps) => (
    <EventFormRoot
        key={`${props.programId}/${props.programStageId}/${props.eventId ?? `new/${props.orgUnitId}/${props.enrollmentId ?? ''}/${props.trackedEntityId ?? ''}`}`}
        {...props}
    />
)
