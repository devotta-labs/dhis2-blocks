import { useConfig } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import type { EditorProblem } from '@/components/dhis2-value-input'
import { todayIso } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { LocationOrgUnit } from '@/components/location-input'
import { explain } from '@/components/program-rules'
import type { Blame, BlameContext } from '@/components/program-rules'
import { displayWith, ruleChanges } from '../lib/explain'
import {
    formReducer,
    initialFormState,
    isDirty,
    storedNow,
    toSend,
} from '../lib/formState'
import type { FormAction, FormState } from '../lib/formState'
import { placeReport } from '../lib/importReport'
import type { Stand } from '../lib/importReport'
import type { HeldEvent, StageForm } from '../lib/metadata'
import { eventPayload } from '../lib/payload'
import { LOCATION, shownFields, validate } from '../lib/validate'
import type { Attempt } from '../lib/validate'
import type { EventFormProps } from '../ui/EventForm'
import { useFormRules } from './useFormRules'
import type { FormRules } from './useFormRules'
import { useSaveEvent } from './useSaveEvent'
import { useStoredNames } from './useStoredNames'

interface Loaded {
    form: StageForm
    settings: ValueSettings
    held?: HeldEvent
    /** The form's org unit and its ancestors, as far as the category options need them. */
    orgUnits: ReadonlySet<string>
    /** The org unit's name and geometry, for a stage that records a location or has a coordinate data element. */
    orgUnit?: LocationOrgUnit
    /** The user may set a completed event back to active. */
    mayUncomplete: boolean
}

export interface EventFormValue extends Omit<Loaded, 'mayUncomplete'> {
    /** The prefix of every field's id: `${formId}-${fieldId}`. */
    formId: string
    baseUrl: string
    state: FormState
    rules: FormRules
    names: ReadonlyMap<string, string>
    /** What each rule did, per field id, fully hidden section id, and `'form'`; absent with `blame="off"`. */
    blames?: ReadonlyMap<string, readonly Blame[]>
    /** How the form says a save succeeded. */
    confirmSaved: NonNullable<EventFormProps['confirmSaved']>
    /** How far from a point org unit a point is before the form warns; absent, the distance is said with no warning. */
    locationWarnKm?: number
    /** The event is completed, and the user may write to the stage and set it back to active. */
    canReopen: boolean
    /** Sends the event as DHIS2 holds it, back as active. */
    reopen(): void
    /** Why the whole form cannot be changed; absent when it can. */
    readOnly?: string
    /** Why the fields cannot be changed now: `readOnly`, else `Saving` while DHIS2 has not answered a save. */
    locked?: string
    /** A save has gone unanswered so long that the form offers to stop waiting for it. */
    stillSaving: boolean
    /** Unlocks the form during a save, whose answer is then ignored. */
    stopWaiting(): void
    commit(
        fieldId: string
    ): (value: string | null, problem?: EditorProblem) => void
    /** Takes the note being typed. */
    writeNote(text: string): void
    submit(attempt: Attempt): void
    confirmComplete(): void
    cancelComplete(): void
}

const categoryStands = (form: StageForm, held: HeldEvent | undefined) => {
    const stands = new Map<string, Stand>()
    for (const { id, options } of form.categories) {
        for (const option of options) {
            stands.set(option.id, { fieldId: id, name: option.name })
            stands.set(option.name, { fieldId: id, name: option.name })
        }
    }
    const first = form.categories[0]
    if (first !== undefined && held?.attributeOptionCombo !== undefined) {
        stands.set(held.attributeOptionCombo, {
            fieldId: first.id,
            name: held.attributeOptionCombo,
        })
    }
    return stands
}

const STILL_SAVING_MS = 15_000

/** The form's state, rules, checks and saving. */
export const useEventForm = (
    {
        programId,
        programStageId,
        orgUnitId,
        enrollmentId,
        trackedEntityId,
        onSaved,
        onDirtyChange,
        onUnsavedRuleChanges,
        blame = 'markers',
        confirmSaved = 'status',
        locationWarnKm,
    }: EventFormProps,
    { form, settings, held, orgUnits, orgUnit, mayUncomplete }: Loaded
) => {
    const formId = useId()
    const { baseUrl } = useConfig()
    const [state, setState] = useState(() =>
        initialFormState(held, todayIso(), form.categories)
    )
    const latest = useRef(state)
    const dispatch = useCallback((action: FormAction) => {
        latest.current = formReducer(latest.current, action)
        setState(latest.current)
    }, [])
    const ruleEventOf = ({ eventId, eventDate, status }: FormState) => ({
        id: eventId,
        occurredAt: eventDate,
        orgUnitId: held?.orgUnit ?? orgUnitId,
        status,
    })
    const rules = useFormRules({
        programId,
        programStageId,
        enrollmentId,
        form,
        entered: state.entered,
        event: ruleEventOf(state),
    })
    const effective = rules.outcome?.effective
    const names = useStoredNames(form, effective ?? state.entered)
    const saveEvent = useSaveEvent(state.eventId, enrollmentId)

    const { outcome, graph, outside } = rules
    const blameContext = (effective: BlameContext['effective']) =>
        ({
            form,
            graph,
            effective,
            stored: state.opened.stored,
            eventDate: state.eventDate,
            display: displayWith(settings, names),
            outside,
        }) satisfies BlameContext
    const blames = useMemo(
        () =>
            blame === 'off' || outcome === undefined
                ? undefined
                : explain(outcome, blameContext(outcome.effective)),
        [
            blame,
            outcome,
            graph,
            state.opened.stored,
            state.eventDate,
            settings,
            names,
            outside,
            form,
        ]
    )

    const before = useRef(outcome)
    useEffect(() => {
        const was = before.current
        before.current = outcome
        if (was === undefined || outcome === undefined || was === outcome) {
            return
        }
        const changes = ruleChanges(
            was,
            outcome,
            blameContext(outcome.effective)
        )
        if (changes !== '') {
            announce(changes)
        }
    }, [outcome])

    let readOnly: string | undefined
    if (!form.canWrite) {
        readOnly = i18n.t('You cannot enter data in this stage')
    } else if (state.status === 'COMPLETED' && form.blockEntryForm) {
        readOnly = i18n.t('This event is completed and locked')
    } else if (rules.status === 'error') {
        readOnly = i18n.t("Program rules didn't load, so the form is read-only")
    }
    const canReopen =
        state.status === 'COMPLETED' &&
        mayUncomplete &&
        form.canWrite &&
        rules.status !== 'error'
    const locked =
        readOnly ?? (state.saving === undefined ? undefined : i18n.t('Saving'))

    const summary = state.summary
    useEffect(() => {
        const first = summary?.invalid[0]
        if (first !== undefined) {
            document.getElementById(`${formId}-${first.fieldId}`)?.focus()
        }
    }, [summary, formId])

    const callbacks = useRef({ onSaved, onDirtyChange, onUnsavedRuleChanges })
    useEffect(() => {
        callbacks.current = { onSaved, onDirtyChange, onUnsavedRuleChanges }
    })
    const dirty = isDirty(state)
    const reportedDirty = useRef(false)
    useEffect(() => {
        if (dirty !== reportedDirty.current) {
            reportedDirty.current = dirty
            callbacks.current.onDirtyChange?.(dirty)
        }
    }, [dirty])

    const inDhis2 = useRef(held !== undefined)
    const stored = state.opened.stored
    const ruleChanged =
        outcome === undefined || dirty || !inDhis2.current
            ? 0
            : [...form.fields.keys()].filter(
                  (fieldId) =>
                      (outcome.assigned.has(fieldId) ||
                          outcome.hidden.has(fieldId)) &&
                      outcome.effective[fieldId] !== stored[fieldId]
              ).length
    const reportedRuleChanged = useRef(0)
    useEffect(() => {
        if (ruleChanged !== reportedRuleChanged.current) {
            reportedRuleChanged.current = ruleChanged
            callbacks.current.onUnsavedRuleChanges?.(ruleChanged)
        }
    }, [ruleChanged])

    const saves = useRef(0)
    const sending = useRef<ReturnType<typeof toSend>>(undefined)
    const [stillSaving, setStillSaving] = useState(false)
    useEffect(() => {
        if (state.saving === undefined) {
            return undefined
        }
        const timer = setTimeout(() => setStillSaving(true), STILL_SAVING_MS)
        return () => {
            clearTimeout(timer)
            setStillSaving(false)
        }
    }, [state.saving])
    const completedFromButton = useRef(false)
    useLayoutEffect(() => {
        if (completedFromButton.current && state.status === 'COMPLETED') {
            completedFromButton.current = false
            ;(
                document.getElementById(`${formId}-reopen`) ??
                document.getElementById(`${formId}-save`)
            )?.focus()
        }
    }, [state.status, formId])
    const stopWaiting = () => {
        saves.current++
        const { effective = {}, location } = sending.current ?? {}
        dispatch({ type: 'stoppedWaiting', sent: { effective, location } })
    }

    const save = async (attempt: Attempt | 'reopen') => {
        const current = latest.current
        const { outcome: now } = rules.rulesFor(
            current.entered,
            ruleEventOf(current)
        )
        if (now === undefined || current.saving !== undefined) {
            return
        }
        dispatch({ type: 'saving', attempt })
        const number = ++saves.current
        const sent = toSend(current, attempt, now.effective)
        sending.current = sent
        const payload = eventPayload({
            eventId: current.eventId,
            programId,
            programStageId,
            orgUnitId,
            enrollmentId,
            trackedEntityId,
            held,
            eventDate: sent.eventDate ?? '',
            status: sent.status,
            effective: sent.effective,
            opened: current.opened.stored,
            categoryOptions:
                form.categories.length === 0
                    ? undefined
                    : form.categories.flatMap(({ id }) => {
                          const option = sent.categories[id]
                          return option === undefined ? [] : [option]
                      }),
            location:
                form.featureType === 'NONE'
                    ? undefined
                    : {
                          now: sent.location,
                          opened: current.opened.storedLocation,
                          featureType: form.featureType,
                      },
            note: sent.note,
        })
        const result = await saveEvent(payload)
        if (number !== saves.current) {
            return
        }
        if (result.ok && attempt === 'reopen') {
            dispatch({ type: 'reopened' })
            callbacks.current.onSaved?.({
                eventId: current.eventId,
                status: 'ACTIVE',
            })
            announce(i18n.t('Reopened'))
            if (document.activeElement?.id === `${formId}-reopen`) {
                document.getElementById(`${formId}-save`)?.focus()
            }
            return
        }
        if (result.ok) {
            inDhis2.current = true
            const { status } = payload.events[0]
            completedFromButton.current =
                document.activeElement?.id === `${formId}-complete`
            dispatch({
                type: 'saved',
                status,
                effective: now.effective,
                storedAt: storedNow(),
            })
            callbacks.current.onSaved?.({ eventId: current.eventId, status })
            return
        }
        const shown = new Map([
            ...form.categories.map(
                ({ id, name }) => [id, name] satisfies [string, string]
            ),
            ...shownFields(form, now).map(
                (fieldId) =>
                    [
                        fieldId,
                        form.fields.get(fieldId)?.label ?? fieldId,
                    ] satisfies [string, string]
            ),
        ])
        const placed =
            result.report === undefined
                ? { fieldErrors: new Map(), formErrors: [] }
                : placeReport(
                      result.report,
                      shown,
                      categoryStands(form, held),
                      form.featureType === 'NONE' ? undefined : LOCATION,
                      sent.effective,
                      new Map([
                          [programId, form.programName],
                          [held?.orgUnit ?? orgUnitId, orgUnit?.name],
                      ])
                  )
        dispatch({
            type: 'saveFailed',
            reason: result.reason,
            fieldErrors: placed.fieldErrors,
            errors: placed.formErrors,
        })
    }

    const commit = useCallback(
        (fieldId: string) =>
            (value: string | null, problem?: EditorProblem) => {
                dispatch({
                    type: 'committed',
                    fieldId,
                    value,
                    problem,
                    category: form.categories.some(({ id }) => id === fieldId),
                })
            },
        [dispatch, form]
    )
    const writeNote = useCallback(
        (text: string) => dispatch({ type: 'noted', text }),
        [dispatch]
    )
    const cancelComplete = useCallback(
        () => dispatch({ type: 'cancelConfirm' }),
        [dispatch]
    )

    const submit = (attempt: Attempt) => {
        const current = latest.current
        const { outcome: now } = rules.rulesFor(
            current.entered,
            ruleEventOf(current)
        )
        if (
            current.saving !== undefined ||
            now === undefined ||
            readOnly !== undefined
        ) {
            return
        }
        const validation = validate(
            {
                form,
                outcome: now,
                problems: current.problems,
                eventDate: current.eventDate,
                status: current.status,
                categories: current.categories,
                orgUnits,
                calendar: settings.calendar,
            },
            attempt
        )
        dispatch({ type: 'attempted', attempt, validation })
        if (validation.invalid.length > 0 || validation.formErrors.length > 0) {
            return
        }
        if (
            attempt === 'complete' &&
            validation.warningsOnComplete.length > 0
        ) {
            dispatch({
                type: 'confirm',
                warnings: validation.warningsOnComplete,
            })
            return
        }
        void save(attempt)
    }

    return {
        form,
        settings,
        held,
        orgUnits,
        orgUnit,
        formId,
        baseUrl,
        state,
        rules,
        names,
        blames,
        confirmSaved,
        locationWarnKm,
        canReopen,
        reopen: () => {
            if (canReopen) {
                void save('reopen')
            }
        },
        readOnly,
        locked,
        stillSaving,
        stopWaiting,
        commit,
        writeNote,
        submit,
        confirmComplete: () => {
            void save('complete')
        },
        cancelComplete,
    } satisfies EventFormValue
}
