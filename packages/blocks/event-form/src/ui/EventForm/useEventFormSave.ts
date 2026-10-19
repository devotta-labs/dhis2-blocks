import { useQueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { programRulesQueryKeys } from '@/registry/program-rules/use-program-rules'
import { eventFormKeys } from '../../api/queries'
import type { StageMetadata } from '../../api/schemas'
import type { FormModel } from '../../model/buildFormModel'
import type { Values } from '../../model/overlay'
import { validateForm } from '../../model/validate'
import { buildEventPayload, type EventNote } from '../../save/payload'
import { useSaveEvent } from '../../save/useSaveEvent'
import type { EventWriter, SaveError, SaveOutcome } from '../../save/writer'
import {
    selectDirty,
    selectNote,
    type EventFormStore,
    type EventFormStoreState,
    type EventStatus,
} from '../../state/store'
import type { EventFormCommands } from './EventFormContext'
import { CONTEXT_FIELD_IDS, isScheduled } from './initialState'

/** What the form renders now; read when an action runs. */
export interface LatestForm {
    model: FormModel
    effective: Values
    readOnly: boolean
}

interface SaveTarget {
    programId: string
    programStageId: string
    enrollmentId: string
    trackedEntityId?: string
    strategy: StageMetadata['stage']['validationStrategy']
}

export interface SaveCallbacks {
    onSaved(result: { eventId: string; outcome: SaveOutcome }): void
    onCancel(): void
}

export type PendingConfirmation = 'complete' | 'discard'

interface SaveArgs {
    store: EventFormStore
    /** This form's writer; the QueryClient's default writer when absent. */
    writer: EventWriter | undefined
    target: SaveTarget
    /** A note went out with a successful save. */
    onNoteSaved(note: EventNote): void
    onSavingChange(saving: boolean): void
    latest: RefObject<LatestForm | null>
    callbacks: RefObject<SaveCallbacks | null>
    container: RefObject<HTMLElement | null>
}

/**
 * Context fields a save needs: an org unit, and a report date unless the event stays scheduled.
 * `status` is the one the save sends, so completing a scheduled event needs a report date.
 */
const contextFailures = (
    context: EventFormStoreState['context'],
    status: EventStatus
): string[] => [
    ...(context.occurredAt === undefined && !isScheduled(status)
        ? [CONTEXT_FIELD_IDS.occurredAt]
        : []),
    ...(context.orgUnitId === undefined ? [CONTEXT_FIELD_IDS.orgUnitId] : []),
]

/** The status a save sends: COMPLETED when completing, else the event's own. */
const targetStatusOf = (status: EventStatus, isCompleting: boolean) =>
    isCompleting ? 'COMPLETED' : status

/**
 * What blocks the action: context fields first, then `validateForm` (field and form-level rule
 * messages, by the stage's strategy). The same check drives the actions and the public state.
 */
export const validateEventForm = (
    model: FormModel,
    state: Pick<EventFormStoreState, 'context' | 'status'>,
    options: { strategy: SaveTarget['strategy']; isCompleting: boolean }
) => {
    const result = validateForm(model, options)
    const failedFieldIds = [
        ...contextFailures(
            state.context,
            targetStatusOf(state.status, options.isCompleting)
        ),
        ...result.failedFieldIds,
    ]
    return {
        isValid: failedFieldIds.length === 0 && result.formErrors.length === 0,
        failedFieldIds,
        formErrors: result.formErrors,
    }
}

const FOCUSABLE =
    'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [role=radio]:not([data-disabled]), [tabindex]:not([tabindex="-1"])'

/** Focuses the first of the fields in document order and scrolls it into view. */
const focusFirstField = (
    container: HTMLElement | null,
    fieldIds: readonly string[]
) => {
    const wanted = new Set(fieldIds)
    const fields = container?.querySelectorAll<HTMLElement>('[data-field-id]')
    const field = [...(fields ?? [])].find((element) =>
        wanted.has(element.dataset.fieldId ?? '')
    )
    if (field === undefined) {
        return
    }
    field.scrollIntoView({ block: 'center' })
    field.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
}

const warnsOnComplete = (model: FormModel) =>
    [...model.fields.values()].some(
        (field) =>
            !field.hidden && field.messages.warningOnComplete !== undefined
    ) ||
    model.formMessages.some((message) => message.kind === 'warningOnComplete')

type ValidationError = Extract<SaveError, { kind: 'validation' }>

/**
 * Server errors stay on a question only when it is shown. An error about a hidden question, or
 * one the stage no longer has, becomes a form error, so it is never reported as "marked on its
 * question" while no question shows it.
 */
const placeOnShownFields = (
    error: ValidationError,
    model: FormModel
): ValidationError => {
    const fieldErrors: Record<string, string> = {}
    const unplaced: string[] = []
    for (const [id, message] of Object.entries(error.fieldErrors)) {
        const field = model.fields.get(id)
        if (field !== undefined && !field.hidden) {
            fieldErrors[id] = message
        } else {
            unplaced.push(
                field === undefined ? message : `${field.label}: ${message}`
            )
        }
    }
    return {
        kind: 'validation',
        fieldErrors,
        formErrors: [...error.formErrors, ...unplaced],
    }
}

const asSaveError = (cause: unknown): SaveError => ({
    kind: 'unknown',
    message: cause instanceof Error ? cause.message : String(cause),
})

/**
 * Save, Complete, Cancel and Reset. Both saves validate first, then post the effective values
 * under the event's one uid, so a second click or a retry can never create a second event. A
 * successful save makes what was sent the form's new starting point.
 */
export const useEventFormSave = ({
    store,
    target,
    latest,
    callbacks,
    container,
    onNoteSaved,
    onSavingChange,
    writer,
}: SaveArgs) => {
    const queryClient = useQueryClient()
    const mutation = useSaveEvent(writer)
    const mutate = useRef(mutation.mutateAsync)
    mutate.current = mutation.mutateAsync
    const inFlight = useRef(false)
    const [saveError, setSaveError] = useState<SaveError>()
    const [pending, setPending] = useState<PendingConfirmation>()
    // Fields the server rejected. They are focused once the save has ended and they are enabled.
    const [focusAfterSave, setFocusAfterSave] = useState<string[]>()
    useEffect(() => {
        if (focusAfterSave !== undefined && !latest.current?.readOnly) {
            focusFirstField(container.current, focusAfterSave)
            setFocusAfterSave(undefined)
        }
    }, [focusAfterSave, latest, container])

    const { programId, programStageId, enrollmentId, trackedEntityId } = target
    const { strategy } = target

    const commands = useMemo(() => {
        const submit = async (
            kind: 'save' | 'complete',
            confirmed: boolean
        ) => {
            const form = latest.current
            if (inFlight.current || form === null || form.readOnly) {
                return
            }
            store.getState().markAttempt(kind)
            const state = store.getState()
            const isCompleting = kind === 'complete'
            const validation = validateEventForm(form.model, state, {
                strategy,
                isCompleting,
            })
            if (!validation.isValid) {
                // A form-level rule error has no field to focus; the actions show it instead.
                focusFirstField(container.current, validation.failedFieldIds)
                return
            }
            if (isCompleting && !confirmed && warnsOnComplete(form.model)) {
                setPending('complete')
                return
            }
            const status = targetStatusOf(state.status, isCompleting)
            const note = selectNote(state)
            const payload = buildEventPayload({
                eventId: state.eventId,
                programId,
                programStageId,
                enrollmentId,
                ...(trackedEntityId !== undefined && { trackedEntityId }),
                status,
                context: state.context,
                effective: form.effective,
                initialStored: state.initialStored,
                ...(note !== undefined && { note }),
                isNew: state.isNew,
            })
            inFlight.current = true
            onSavingChange(true)
            setSaveError(undefined)
            const result = await mutate
                .current(payload)
                .catch((cause: unknown) => Result.err(asSaveError(cause)))
            inFlight.current = false
            onSavingChange(false)
            if (result.isErr()) {
                if (result.error.kind === 'validation') {
                    const error = placeOnShownFields(result.error, form.model)
                    setSaveError(error)
                    store.getState().setFieldErrors(error.fieldErrors)
                    setFocusAfterSave(Object.keys(error.fieldErrors))
                } else {
                    setSaveError(result.error)
                }
                return
            }
            if (note !== undefined) {
                onNoteSaved(note)
            }
            store.getState().markSaved({
                stored: form.effective,
                context: state.context,
                status,
            })
            void queryClient.invalidateQueries({
                queryKey: programRulesQueryKeys.enrollment(enrollmentId),
            })
            void queryClient.invalidateQueries({
                queryKey: eventFormKeys.event(state.eventId),
            })
            callbacks.current?.onSaved({
                eventId: state.eventId,
                outcome: result.value.outcome,
            })
        }

        const value: EventFormCommands = {
            save: () => submit('save', false),
            complete: () => submit('complete', false),
            cancel: () => {
                // A save in flight ends in onSaved or an error; cancelling under it would do both.
                if (inFlight.current) {
                    return
                }
                if (selectDirty(store.getState())) {
                    setPending('discard')
                } else {
                    callbacks.current?.onCancel()
                }
            },
            reset: () => {
                store.getState().reset()
                setSaveError(undefined)
            },
        }
        const confirm = (confirmation: PendingConfirmation) => {
            setPending(undefined)
            if (confirmation === 'complete') {
                void submit('complete', true)
            } else {
                value.reset()
                callbacks.current?.onCancel()
            }
        }
        return { commands: value, confirm }
    }, [
        store,
        latest,
        callbacks,
        container,
        onNoteSaved,
        onSavingChange,
        queryClient,
        strategy,
        programId,
        programStageId,
        enrollmentId,
        trackedEntityId,
    ])

    return {
        ...commands,
        dismiss: () => setPending(undefined),
        pending,
        saveError,
    }
}
