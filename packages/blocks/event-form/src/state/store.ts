import { createStore, type StoreApi } from 'zustand/vanilla'
import type { TrackerEvent } from '../api/schemas'
import type { Values } from '../model/overlay'

export type EventStatus = TrackerEvent['status']

export interface EventContext {
    /** `yyyy-MM-dd`. */
    occurredAt?: string
    orgUnitId?: string
    geometry?: { type: 'Point'; coordinates: [number, number] }
}

/** A key set to `undefined` removes that key from the context. */
type EventContextPatch = {
    [K in keyof EventContext]?: EventContext[K] | undefined
}

export interface EventFormStoreInit {
    eventId: string
    isNew: boolean
    stored: Values
    context: EventContext
    status: EventStatus
}

export interface EventFormStoreState {
    eventId: string
    isNew: boolean
    /** What the user has entered, in tracker API format. Rule effects are never written here. */
    stored: Values
    initialStored: Values
    context: EventContext
    initialContext: EventContext
    noteDraft: string
    status: EventStatus
    /** The furthest action the user has tried; drives when errors are shown. */
    attempt: 'none' | 'save' | 'complete'
    /** Errors from the server by data element id. Editing a field clears its error. */
    fieldErrors: Readonly<Record<string, string>>
    commitValue(id: string, value: string | undefined): void
    setContext(patch: EventContextPatch): void
    setNoteDraft(text: string): void
    setStatus(status: EventStatus): void
    markAttempt(kind: 'save' | 'complete'): void
    setFieldErrors(errors: Readonly<Record<string, string>>): void
    /**
     * After a successful save: what was sent becomes the opened state, as if the event had been
     * loaded again. `stored` is the effective values the server now holds.
     */
    markSaved(saved: SavedEvent): void
    reset(): void
}

interface SavedEvent {
    stored: Values
    context: EventContext
    status: EventStatus
}

export type EventFormStore = StoreApi<EventFormStoreState>

const sameValues = (a: Values, b: Values) => {
    const keys = Object.keys(a)
    return (
        keys.length === Object.keys(b).length &&
        keys.every((key) => a[key] === b[key])
    )
}

const sameContext = (a: EventContext, b: EventContext) =>
    a.occurredAt === b.occurredAt &&
    a.orgUnitId === b.orgUnitId &&
    a.geometry?.type === b.geometry?.type &&
    a.geometry?.coordinates[0] === b.geometry?.coordinates[0] &&
    a.geometry?.coordinates[1] === b.geometry?.coordinates[1]

/** Rule effects live outside the store, so they can never make the form dirty. */
export const selectDirty = (state: EventFormStoreState) =>
    !sameValues(state.stored, state.initialStored) ||
    !sameContext(state.context, state.initialContext) ||
    state.noteDraft.trim() !== ''

const ATTEMPT_RANK = { none: 0, save: 1, complete: 2 } as const

export const createEventFormStore = (
    init: EventFormStoreInit
): EventFormStore => {
    // What `reset` returns to; a successful save replaces it.
    let opened: SavedEvent = {
        stored: init.stored,
        context: init.context,
        status: init.status,
    }
    return createStore<EventFormStoreState>((set) => ({
        eventId: init.eventId,
        isNew: init.isNew,
        stored: opened.stored,
        initialStored: opened.stored,
        context: opened.context,
        initialContext: opened.context,
        noteDraft: '',
        status: opened.status,
        attempt: 'none',
        fieldErrors: {},
        commitValue: (id, value) =>
            set((state) => {
                const { [id]: _removed, ...rest } = state.stored
                const { [id]: _error, ...errors } = state.fieldErrors
                return {
                    stored:
                        value === undefined ? rest : { ...rest, [id]: value },
                    fieldErrors:
                        id in state.fieldErrors ? errors : state.fieldErrors,
                }
            }),
        setContext: (patch) =>
            set((state) => {
                // A key in the patch set to `undefined` overrides the old value, then is dropped.
                const { occurredAt, orgUnitId, geometry } = {
                    ...state.context,
                    ...patch,
                }
                return {
                    context: {
                        ...(occurredAt !== undefined && { occurredAt }),
                        ...(orgUnitId !== undefined && { orgUnitId }),
                        ...(geometry !== undefined && { geometry }),
                    },
                }
            }),
        setNoteDraft: (noteDraft) => set({ noteDraft }),
        setStatus: (status) => set({ status }),
        markAttempt: (kind) =>
            set((state) =>
                ATTEMPT_RANK[kind] > ATTEMPT_RANK[state.attempt]
                    ? { attempt: kind }
                    : state
            ),
        setFieldErrors: (fieldErrors) => set({ fieldErrors }),
        markSaved: (saved) => {
            opened = saved
            set({
                isNew: false,
                stored: saved.stored,
                initialStored: saved.stored,
                context: saved.context,
                initialContext: saved.context,
                noteDraft: '',
                status: saved.status,
                attempt: 'none',
                fieldErrors: {},
            })
        },
        reset: () =>
            set({
                stored: opened.stored,
                context: opened.context,
                noteDraft: '',
                status: opened.status,
                attempt: 'none',
                fieldErrors: {},
            }),
    }))
}
