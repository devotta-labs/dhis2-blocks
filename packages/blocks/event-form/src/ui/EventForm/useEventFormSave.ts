import { useQueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { RuleEffects } from '@/registry/program-rules/index'
import { programRulesQueryKeys } from '@/registry/program-rules/use-program-rules'
import { eventFormKeys } from '../../api/queries'
import type { StageMetadata } from '../../api/schemas'
import type { FormModel } from '../../model/buildFormModel'
import type { Values } from '../../model/overlay'
import { validateForm } from '../../model/validate'
import { buildEventPayload } from '../../save/payload'
import { useSaveEvent } from '../../save/useSaveEvent'
import type { SaveError, SaveOutcome } from '../../save/writer'
import {
    selectDirty,
    type EventFormStore,
    type EventFormStoreState,
} from '../../state/store'
import type { EventFormCommands } from './EventFormContext'
import { CONTEXT_FIELD_IDS, isScheduled } from './initialState'

/** What the form renders now; read when an action runs. */
export interface LatestForm {
    model: FormModel
    effective: Values
    effects: RuleEffects | undefined
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
    target: SaveTarget
    /** A note went out with a successful save. */
    onNoteSaved(note: string): void
    onSavingChange(saving: boolean): void
    latest: RefObject<LatestForm | null>
    callbacks: RefObject<SaveCallbacks | null>
    container: RefObject<HTMLElement | null>
}

/** Context fields a save needs: a report date (unless the event is still scheduled) and an org unit. */
export const contextFailures = ({
    context,
    status,
}: Pick<EventFormStoreState, 'context' | 'status'>): string[] => [
    ...(context.occurredAt === undefined && !isScheduled(status)
        ? [CONTEXT_FIELD_IDS.occurredAt]
        : []),
    ...(context.orgUnitId === undefined ? [CONTEXT_FIELD_IDS.orgUnitId] : []),
]

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

const warnsOnComplete = (model: FormModel, effects: RuleEffects | undefined) =>
    [...model.fields.values()].some(
        (field) =>
            !field.hidden && field.messages.warningOnComplete !== undefined
    ) ||
    (effects?.messages.get('form') ?? []).some(
        (message) => message.kind === 'warningOnComplete'
    )

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
}: SaveArgs) => {
    const queryClient = useQueryClient()
    const mutation = useSaveEvent()
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
            const failed = [
                ...contextFailures(state),
                ...validateForm(form.model, { strategy, isCompleting })
                    .failedFieldIds,
            ]
            if (failed.length > 0) {
                focusFirstField(container.current, failed)
                return
            }
            if (
                isCompleting &&
                !confirmed &&
                warnsOnComplete(form.model, form.effects)
            ) {
                setPending('complete')
                return
            }
            const status = isCompleting ? 'COMPLETED' : state.status
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
                noteDraft: state.noteDraft,
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
                setSaveError(result.error)
                if (result.error.kind === 'validation') {
                    store.getState().setFieldErrors(result.error.fieldErrors)
                    setFocusAfterSave(Object.keys(result.error.fieldErrors))
                }
                return
            }
            const note = state.noteDraft.trim()
            if (note !== '') {
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
