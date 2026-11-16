import {
    formatCalendarDate,
    getNowInCalendar,
} from '@dhis2/multi-calendar-dates'
import { storedDay } from '@/components/dhis2-value-display'
import type { EditorProblem } from '@/components/dhis2-value-input'
import type { RuleEventStatus } from '@/components/program-rules'
import { heldChoices } from './categories'
import { pointValue } from './location'
import { sameValues, valuesOf } from './metadata'
import type { Category, EventNote, HeldEvent, Values } from './metadata'
import { generateUid } from './uid'
import { EVENT_DATE, LOCATION } from './validate'
import type { Attempt, Validation } from './validate'

export interface FormState {
    eventId: string
    entered: Values
    eventDate?: string
    /** Category id → the option chosen. */
    categories: Values
    /** The event's point as the coordinate value `[lng,lat]`. */
    location?: string
    status: RuleEventStatus
    /** The event's notes, oldest first: as opened, then each one this form saved, marked `yours`. */
    notes: ReadonlyArray<EventNote & { yours?: boolean }>
    /** The note being typed, and the id it is sent with until it is saved. */
    note: { id: string; text: string }
    /** Field or `EVENT_DATE` → `ValueInput`'s problem message. */
    problems: ReadonlyMap<string, string>
    /** The baseline: as opened, then as last sent. `stored` is what DHIS2 holds, so a save deletes what left it. */
    opened: {
        entered: Values
        stored: Values
        eventDate?: string
        categories: Values
        location?: string
    }
    attempt?: Attempt
    summary?: Validation
    /** Warnings on complete awaiting "Complete anyway". */
    confirming?: readonly string[]
    /** What DHIS2 has not answered yet: a save, a complete, or a reopen. */
    saving?: Attempt | 'reopen'
    /** The last save succeeded and nothing was changed since. */
    saved: boolean
    serverErrors: ReadonlyMap<string, readonly string[]>
    /** The last save's failure; `reopen` when it was a reopen. */
    saveError?: { reason?: string; errors: readonly string[]; reopen: boolean }
}

export type FormAction =
    | {
          type: 'committed'
          fieldId: string
          value: string | null
          problem?: EditorProblem
          /** The field is a category of the combination, not a data element. */
          category?: boolean
      }
    | { type: 'attempted'; attempt: Attempt; validation: Validation }
    | { type: 'confirm'; warnings: readonly string[] }
    | { type: 'cancelConfirm' }
    | { type: 'noted'; text: string }
    | { type: 'saving'; attempt: Attempt | 'reopen' }
    /** The form stopped waiting for DHIS2 to answer the save. */
    | { type: 'stoppedWaiting' }
    | {
          type: 'saved'
          status: RuleEventStatus
          effective: Values
          /** When the typed note was stored, as DHIS2 writes a time. */
          storedAt: string
      }
    /** DHIS2 set the completed event back to active; what is typed and not saved stays so. */
    | { type: 'reopened' }
    | {
          type: 'saveFailed'
          reason?: string
          fieldErrors: ReadonlyMap<string, readonly string[]>
          errors: readonly string[]
      }

export const initialFormState = (
    held: HeldEvent | undefined,
    today: string,
    categoryList: readonly Category[] = []
): FormState => {
    const entered = held === undefined ? {} : valuesOf(held)
    const eventDate =
        held === undefined
            ? today
            : held.occurredAt && storedDay(held.occurredAt)
    const categories = heldChoices(held, categoryList)
    const location = pointValue(held?.geometry)
    return {
        eventId: held?.event ?? generateUid(),
        entered,
        eventDate,
        categories,
        location,
        status: held?.status ?? 'ACTIVE',
        notes: held?.notes ?? [],
        note: { id: generateUid(), text: '' },
        problems: new Map(),
        saved: false,
        opened: { entered, stored: entered, eventDate, categories, location },
        serverErrors: new Map(),
    }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** The device's time as DHIS2 writes a stored one: `YYYY-MM-DDTHH:mm:ss`. */
export const storedNow = () => {
    const now = getNowInCalendar('gregory')
    return `${formatCalendarDate(now)}T${pad(now.hour)}:${pad(now.minute)}:${pad(now.second)}`
}

const without = <T>(map: ReadonlyMap<string, T>, key: string) => {
    const rest = new Map(map)
    rest.delete(key)
    return rest
}

const committed = (
    state: FormState,
    {
        fieldId,
        value,
        problem,
        category,
    }: Extract<FormAction, { type: 'committed' }>
): FormState => {
    // A problem keeps the last good value: the text typed is not a value yet.
    if (problem !== undefined) {
        return {
            ...state,
            problems: new Map(state.problems).set(fieldId, problem.message),
        }
    }
    const cleared = {
        ...state,
        problems: without(state.problems, fieldId),
        serverErrors: without(state.serverErrors, fieldId),
    }
    if (fieldId === EVENT_DATE) {
        return { ...cleared, eventDate: value ?? undefined }
    }
    if (fieldId === LOCATION) {
        return { ...cleared, location: value ?? undefined }
    }
    const values = category ? state.categories : state.entered
    const { [fieldId]: _replaced, ...rest } = values
    const next =
        value === null || value === '' ? rest : { ...rest, [fieldId]: value }
    return category
        ? { ...cleared, categories: next }
        : { ...cleared, entered: next }
}

export const formReducer = (
    state: FormState,
    action: FormAction
): FormState => {
    switch (action.type) {
        // An edit ends the form's "Saved".
        case 'committed':
            return committed({ ...state, saved: false }, action)
        case 'attempted':
            return {
                ...state,
                attempt: action.attempt,
                summary: action.validation,
            }
        case 'confirm':
            return { ...state, confirming: action.warnings }
        case 'cancelConfirm':
            return { ...state, confirming: undefined }
        case 'noted':
            return {
                ...state,
                note: { ...state.note, text: action.text },
                saved: false,
            }
        case 'saving':
            return {
                ...state,
                saving: action.attempt,
                confirming: undefined,
                saved: false,
            }
        case 'stoppedWaiting':
            return { ...state, saving: undefined }
        case 'saved': {
            const text = state.note.text.trim()
            return {
                ...state,
                status: action.status,
                // The form is read-only while it saves, so what was sent is what it holds.
                opened: {
                    entered: state.entered,
                    stored: action.effective,
                    eventDate: state.eventDate,
                    categories: state.categories,
                    location: state.location,
                },
                notes:
                    text === ''
                        ? state.notes
                        : [
                              ...state.notes,
                              {
                                  note: state.note.id,
                                  value: text,
                                  storedAt: action.storedAt,
                                  yours: true,
                              },
                          ],
                note: { id: generateUid(), text: '' },
                saving: undefined,
                saved: true,
                summary: undefined,
                saveError: undefined,
                serverErrors: new Map(),
            }
        }
        case 'reopened':
            return {
                ...state,
                status: 'ACTIVE',
                saving: undefined,
                summary: undefined,
                saveError: undefined,
                serverErrors: new Map(),
            }
        case 'saveFailed':
            return {
                ...state,
                saving: undefined,
                serverErrors: action.fieldErrors,
                saveError: {
                    reason: action.reason,
                    errors: action.errors,
                    reopen: state.saving === 'reopen',
                },
            }
    }
}

/** Whether the user changed anything since the form opened or last saved, a note typed included. */
export const isDirty = (state: FormState) =>
    state.note.text.trim() !== '' ||
    state.eventDate !== state.opened.eventDate ||
    state.location !== state.opened.location ||
    !sameValues(state.entered, state.opened.entered) ||
    !sameValues(state.categories, state.opened.categories)

/**
 * What an attempt sends: what is typed, with `effective` (the values the rules settle on), and the note. A reopen sends
 * the event as DHIS2 holds it, as active, and nothing typed since.
 */
export const toSend = (
    state: FormState,
    attempt: Attempt | 'reopen',
    effective: Values
) =>
    attempt === 'reopen'
        ? {
              status: 'ACTIVE' as const,
              eventDate: state.opened.eventDate,
              categories: state.opened.categories,
              location: state.opened.location,
              effective: state.opened.stored,
              note: undefined,
          }
        : {
              status:
                  attempt === 'complete'
                      ? ('COMPLETED' as const)
                      : state.status,
              eventDate: state.eventDate,
              categories: state.categories,
              location: state.location,
              effective,
              note: state.note,
          }
