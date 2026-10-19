import { useQueryClient } from '@tanstack/react-query'
import React, {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import { useStore } from 'zustand'
import { cn } from '@/registry/dhis2/ui/cn'
import type {
    StageMetadata,
    SystemCalendar,
    TrackerEvent,
} from '../../api/schemas'
import { useEventFormClient } from '../../api/runtimeClient'
import { validateForm } from '../../model/validate'
import { generateUid } from '../../save/uid'
import {
    eventFormMutationKeys,
    registerEventFormMutations,
} from '../../save/useSaveEvent'
import { createOnlineEventWriter, type EventWriter } from '../../save/writer'
import {
    createEventFormStore,
    selectDirty,
    type EventContext,
} from '../../state/store'
import { EventFormDialogs } from '../EventFormDialogs'
import { EventFormRuleNotice } from '../EventFormRuleNotice'
import { EventFormStatusNotice } from '../EventFormStatusNotice'
import {
    createFormModelSource,
    EventFormFieldContext,
    EventFormInternalContext,
    EventFormRulesContext,
    EventFormStateContext,
    type EventFormFieldContextValue,
    type EventFormInternalValue,
    type EventFormReadOnlyReason,
    type EventFormState,
} from './EventFormContext'
import {
    isScheduled,
    loadedEventInit,
    newEventInit,
    todayIso,
    toGeometry,
} from './initialState'
import { useEventFormModel } from './useEventFormModel'
import {
    contextFailures,
    useEventFormSave,
    type LatestForm,
    type SaveCallbacks,
} from './useEventFormSave'

export interface EventFormProviderProps extends SaveCallbacks {
    programId: string
    programStageId: string
    enrollmentId: string
    orgUnitId: string
    trackedEntityId?: string
    writer?: EventWriter
    metadata: StageMetadata
    /** The loaded event; absent for a new one. Only its first value opens the store. */
    event: TrackerEvent | undefined
    calendar: SystemCalendar
    orgUnitRoots: readonly string[]
    className?: string
    children: ReactNode
}

const NO_NOTES: TrackerEvent['notes'] = []

/** Registers the writer as the save mutation's default; a host-registered writer is kept. */
const useWriterRegistration = (writer: EventWriter | undefined) => {
    const queryClient = useQueryClient()
    const client = useEventFormClient()
    useEffect(() => {
        if (writer !== undefined) {
            registerEventFormMutations(queryClient, writer)
        } else if (
            queryClient.getMutationDefaults(eventFormMutationKeys.save)
                .mutationFn === undefined
        ) {
            registerEventFormMutations(
                queryClient,
                createOnlineEventWriter(client)
            )
        }
    }, [queryClient, client, writer])
}

const readOnlyReasonOf = (
    status: EventFormState['status'],
    blockEntryForm: boolean,
    rulesStatus: 'loading' | 'ready' | 'error'
): EventFormReadOnlyReason | undefined => {
    if (status === 'SKIPPED') {
        return 'skipped'
    }
    if (status === 'COMPLETED' && blockEntryForm) {
        return 'completed'
    }
    if (rulesStatus === 'error') {
        return 'rulesFailed'
    }
    return rulesStatus === 'loading' ? 'rulesLoading' : undefined
}

/**
 * The form's state: one store per form instance, opened from a snapshot of the loaded event, with
 * rule effects, the model and the commands derived from it, provided to every part. It renders
 * nothing of its own but the container, the notices and the confirmation dialogs.
 */
export const EventFormProvider = ({
    programId,
    programStageId,
    enrollmentId,
    orgUnitId,
    trackedEntityId,
    writer,
    metadata,
    event,
    calendar,
    orgUnitRoots,
    className,
    children,
    onSaved,
    onCancel,
}: EventFormProviderProps) => {
    // Created once: a refetched event never replaces what is being edited.
    const [store] = useState(() =>
        createEventFormStore(
            event === undefined
                ? newEventInit({ eventId: generateUid(), orgUnitId })
                : loadedEventInit(event)
        )
    )
    const [scheduledAt] = useState(() => event?.scheduledAt)
    useWriterRegistration(writer)

    const { model, effective, rules } = useEventFormModel({
        store,
        metadata,
        programId,
        programStageId,
        enrollmentId,
        scheduledAt,
    })

    const status = useStore(store, (state) => state.status)
    const attempt = useStore(store, (state) => state.attempt)
    const dirty = useStore(store, selectDirty)
    const eventId = useStore(store, (state) => state.eventId)
    const isNew = useStore(store, (state) => state.isNew)
    const context = useStore(store, (state) => state.context)
    const { blockEntryForm, validationStrategy } = metadata.stage
    const readOnlyReason = readOnlyReasonOf(
        status,
        blockEntryForm,
        rules.status
    )
    const [saving, setSaving] = useState(false)
    // Nothing can be edited while a save is in flight: the saved values become the new start.
    const readOnly = readOnlyReason !== undefined || saving

    const latest = useRef<LatestForm | null>(null)
    latest.current = { model, effective, effects: rules.effects, readOnly }
    const callbacks = useRef<SaveCallbacks | null>(null)
    callbacks.current = { onSaved, onCancel }
    const container = useRef<HTMLDivElement>(null)
    // Notes saved by this form, shown until the event, refetched, lists them itself.
    const [sessionNotes, setSessionNotes] = useState<TrackerEvent['notes']>([])
    const onNoteSaved = useCallback(
        (value: string) =>
            setSessionNotes((saved) => [
                ...saved,
                {
                    note: `saved-${saved.length}`,
                    value,
                    storedAt: new Date().toISOString(),
                },
            ]),
        []
    )
    const save = useEventFormSave({
        store,
        target: {
            programId,
            programStageId,
            enrollmentId,
            ...(trackedEntityId !== undefined && { trackedEntityId }),
            strategy: validationStrategy,
        },
        latest,
        callbacks,
        container,
        onNoteSaved,
        onSavingChange: setSaving,
    })

    const [source] = useState(() => createFormModelSource(model))
    useLayoutEffect(() => {
        source.setModel(model)
    }, [source, model])

    /** The first answer to a scheduled event starts it: ACTIVE, with today as its report date. */
    const startIfScheduled = useCallback(() => {
        const state = store.getState()
        if (!isScheduled(state.status)) {
            return
        }
        state.setStatus('ACTIVE')
        if (state.context.occurredAt === undefined) {
            state.setContext({ occurredAt: todayIso() })
        }
    }, [store])
    const commit = useCallback(
        (id: string, value: string | undefined) => {
            startIfScheduled()
            store.getState().commitValue(id, value)
        },
        [store, startIfScheduled]
    )
    const commitContext = useCallback(
        (field: keyof EventContext, value: string | undefined) => {
            startIfScheduled()
            store.getState().setContext({
                [field]: field === 'geometry' ? toGeometry(value) : value,
            })
        },
        [store, startIfScheduled]
    )

    const fieldContext = useMemo<EventFormFieldContextValue>(
        () => ({ source, commit, calendar, readOnly, orgUnitRoots }),
        [source, commit, calendar, readOnly, orgUnitRoots]
    )

    const instanceId = useId()
    const sectionHeadingId = useCallback(
        (sectionId: string) => `${instanceId}-section-${sectionId}`,
        [instanceId]
    )
    const { name, executionDateLabel, featureType } = metadata.stage
    const stage = useMemo(
        () => ({
            name,
            featureType,
            ...(executionDateLabel !== undefined && { executionDateLabel }),
        }),
        [name, executionDateLabel, featureType]
    )
    const loadedNotes = event?.notes ?? NO_NOTES
    const notes = useMemo(
        () => [
            ...loadedNotes,
            ...sessionNotes.filter(
                (saved) =>
                    !loadedNotes.some((loaded) => loaded.value === saved.value)
            ),
        ],
        [loadedNotes, sessionNotes]
    )
    const internal = useMemo<EventFormInternalValue>(
        () => ({
            store,
            actions: save.commands,
            commitContext,
            sectionHeadingId,
            stage,
            notes,
        }),
        [store, save.commands, commitContext, sectionHeadingId, stage, notes]
    )

    const validation = useMemo(() => {
        const result = validateForm(model, {
            strategy: validationStrategy,
            isCompleting: attempt === 'complete',
        })
        const failedFieldIds = [
            ...contextFailures({ context, status }),
            ...result.failedFieldIds,
        ]
        return { isValid: failedFieldIds.length === 0, failedFieldIds }
    }, [model, validationStrategy, attempt, context, status])

    const publicValue = useMemo(() => {
        const state: EventFormState = {
            eventId,
            isNew,
            status,
            values: effective,
            dirty,
            readOnly,
            ...(readOnlyReason !== undefined && { readOnlyReason }),
            attempt,
            saving,
            validation,
            ...(save.saveError !== undefined && { saveError: save.saveError }),
        }
        return { model, state }
    }, [
        model,
        eventId,
        isNew,
        status,
        effective,
        dirty,
        readOnly,
        readOnlyReason,
        attempt,
        saving,
        save.saveError,
        validation,
    ])

    return (
        <EventFormFieldContext.Provider value={fieldContext}>
            <EventFormInternalContext.Provider value={internal}>
                <EventFormRulesContext.Provider value={rules}>
                    <EventFormStateContext.Provider value={publicValue}>
                        <div
                            ref={container}
                            className={cn('flex flex-col gap-4', className)}
                            data-testid="event-form"
                        >
                            <EventFormStatusNotice />
                            <EventFormRuleNotice />
                            {children}
                        </div>
                        <EventFormDialogs
                            pending={save.pending}
                            onConfirm={save.confirm}
                            onDismiss={save.dismiss}
                        />
                    </EventFormStateContext.Provider>
                </EventFormRulesContext.Provider>
            </EventFormInternalContext.Provider>
        </EventFormFieldContext.Provider>
    )
}
