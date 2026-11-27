import { SAVED_FUNDED_VISIT, SAVED_VISIT } from '../__tests__/childVisit'
import { childVisitForm } from '../__tests__/forms'
import { formReducer, initialFormState, isDirty, toSend } from './formState'
import type { FormState } from './formState'
import { heldEventSchema } from './metadata'
import { EVENT_DATE, LOCATION } from './validate'
import type { Validation } from './validate'

const held = heldEventSchema.parse(SAVED_VISIT)
const HELD_POINT = '{"type":"Point","coordinates":[-11.42,8.47]}'
const MOVED_POINT = '{"type":"Point","coordinates":[-11.5,8.5]}'
const opened = () => initialFormState(held, '2026-11-12')
const commit = (
    state: FormState,
    fieldId: string,
    value: string | null,
    problem?: string
) =>
    formReducer(state, {
        type: 'committed',
        fieldId,
        value,
        problem:
            problem === undefined ? undefined : { message: problem, text: 'x' },
    })

const FAILED: Validation = {
    invalid: [{ fieldId: 'labWeight01', text: 'Required' }],
    formErrors: [],
    warningsOnComplete: [],
}

describe('initialFormState', () => {
    it('starts a new event with a fresh uid, today and ACTIVE', () => {
        const state = initialFormState(undefined, '2026-11-12')
        expect(state.eventId).toMatch(/^[A-Za-z][A-Za-z0-9]{10}$/)
        expect(state).toMatchObject({
            entered: {},
            eventDate: '2026-11-12',
            status: 'ACTIVE',
        })
        expect(isDirty(state)).toBe(false)
    })

    it('opens a saved event with its id, day and status', () => {
        const state = opened()
        expect(state).toMatchObject({
            eventId: 'labVisit001',
            eventDate: '2026-11-02',
            status: 'ACTIVE',
            entered: { labWeight01: '12', labOutcome1: 'HOME' },
        })
        expect(state.opened.stored).toEqual(state.entered)
        expect(isDirty(state)).toBe(false)
    })
})

describe('formReducer', () => {
    it('keeps the last good value on a problem and records it', () => {
        const state = commit(opened(), 'labWeight01', null, 'Not a number')
        expect(state.entered.labWeight01).toBe('12')
        expect(state.problems.get('labWeight01')).toBe('Not a number')
    })

    it('clears the problem and the server errors on a good value', () => {
        const failed = formReducer(
            commit(opened(), 'labWeight01', null, 'Not a number'),
            {
                type: 'saveFailed',
                fieldErrors: new Map([['labWeight01', ['Too heavy']]]),
                errors: [],
            }
        )
        const state = commit(failed, 'labWeight01', '13')
        expect(state.entered.labWeight01).toBe('13')
        expect(state.problems.has('labWeight01')).toBe(false)
        expect(state.serverErrors.has('labWeight01')).toBe(false)
    })

    it('clears a value committed empty, and takes the event date', () => {
        let state = commit(opened(), 'labWeight01', null)
        state = commit(state, EVENT_DATE, '2026-11-03')
        expect(state.entered).not.toHaveProperty('labWeight01')
        expect(state.eventDate).toBe('2026-11-03')
        expect(isDirty(state)).toBe(true)
    })

    it('is not dirty once a value is put back', () => {
        const state = commit(
            commit(opened(), 'labWeight01', '13'),
            'labWeight01',
            '12'
        )
        expect(isDirty(state)).toBe(false)
    })

    it('holds an attempt, a confirmation and a save', () => {
        let state = formReducer(opened(), {
            type: 'attempted',
            attempt: 'complete',
            validation: FAILED,
        })
        expect(state).toMatchObject({ attempt: 'complete', summary: FAILED })
        state = formReducer(state, { type: 'confirm', warnings: ['Check'] })
        expect(state.confirming).toEqual(['Check'])
        state = formReducer(state, { type: 'cancelConfirm' })
        expect(state.confirming).toBeUndefined()
        state = formReducer(state, { type: 'saving', attempt: 'complete' })
        expect(state.saving).toBe('complete')
    })

    it('makes the sent values the baseline once saved', () => {
        let state = commit(opened(), 'labWeight01', '13')
        state = formReducer(state, {
            type: 'attempted',
            attempt: 'save',
            validation: FAILED,
        })
        state = formReducer(state, { type: 'saving', attempt: 'save' })
        state = formReducer(state, {
            type: 'saveFailed',
            reason: 'Conflict',
            fieldErrors: new Map(),
            errors: ['about the form'],
        })
        expect(state.saving).toBeUndefined()
        expect(state.saveError).toEqual({
            reason: 'Conflict',
            errors: ['about the form'],
            reopen: false,
        })
        state = formReducer(state, {
            type: 'saved',
            status: 'COMPLETED',
            effective: { labWeight01: '13', labDoseMg01: '26' },
            storedAt: '2026-11-16T10:30:00.000',
        })
        expect(state.opened).toEqual({
            entered: state.entered,
            stored: { labWeight01: '13', labDoseMg01: '26' },
            eventDate: '2026-11-02',
            categories: {},
            location: HELD_POINT,
            storedLocation: HELD_POINT,
        })
        expect(state).toMatchObject({ status: 'COMPLETED' })
        expect(state.saving).toBeUndefined()
        expect(state.summary).toBeUndefined()
        expect(state.saveError).toBeUndefined()
        expect(isDirty(state)).toBe(false)
    })

    it('reopens as active, keeping what is typed unsaved and the baseline as DHIS2 holds it', () => {
        const completed = initialFormState(
            heldEventSchema.parse({ ...SAVED_VISIT, status: 'COMPLETED' }),
            '2026-11-12'
        )
        let state = commit(completed, 'labWeight01', '13')
        state = formReducer(state, { type: 'saving', attempt: 'reopen' })
        state = formReducer(state, {
            type: 'saveFailed',
            fieldErrors: new Map(),
            errors: ['not authorized'],
        })
        expect(state.saveError).toEqual({
            errors: ['not authorized'],
            reopen: true,
        })
        expect(state.status).toBe('COMPLETED')
        state = formReducer(state, { type: 'saving', attempt: 'reopen' })
        state = formReducer(state, { type: 'reopened' })
        expect(state).toMatchObject({ status: 'ACTIVE', saved: false })
        expect(state.saving).toBeUndefined()
        expect(state.saveError).toBeUndefined()
        expect(state.entered.labWeight01).toBe('13')
        expect(state.opened).toEqual(completed.opened)
        expect(isDirty(state)).toBe(true)
    })

    it('opens with the notes the event holds, and none for a new event', () => {
        expect(opened().notes.map(({ value }) => value)).toEqual([
            'Mother reports fever since Sunday.',
            'Weighed again after feeding.',
        ])
        expect(initialFormState(undefined, '2026-11-12').notes).toEqual([])
    })

    it('makes a typed note an unsaved change, keeps it and its id through a failed save, and lists it once saved', () => {
        let state = formReducer(opened(), { type: 'noted', text: '  Seen  ' })
        const { id } = state.note
        expect(isDirty(state)).toBe(true)
        state = formReducer(state, { type: 'saving', attempt: 'save' })
        state = formReducer(state, {
            type: 'saveFailed',
            fieldErrors: new Map(),
            errors: [],
        })
        expect(state.note).toEqual({ id, text: '  Seen  ' })
        state = formReducer(state, {
            type: 'saved',
            status: 'ACTIVE',
            effective: state.entered,
            storedAt: '2026-11-16T10:30:00.000',
        })
        expect(state.notes.at(-1)).toEqual({
            note: id,
            value: 'Seen',
            storedAt: '2026-11-16T10:30:00.000',
            yours: true,
        })
        expect(state.notes).toHaveLength(3)
        expect(state.note.text).toBe('')
        expect(state.note.id).not.toBe(id)
        expect(isDirty(state)).toBe(false)
    })

    it('lists nothing for a blank note, and it is no change', () => {
        let state = formReducer(opened(), { type: 'noted', text: ' \n ' })
        expect(isDirty(state)).toBe(false)
        state = formReducer(state, {
            type: 'saved',
            status: 'ACTIVE',
            effective: state.entered,
            storedAt: '2026-11-16T10:30:00.000',
        })
        expect(state.notes).toHaveLength(2)
    })
})

describe('location', () => {
    it('opens with the geometry the event holds, written out, and none for a new event', () => {
        expect(opened().location).toBe(HELD_POINT)
        expect(
            initialFormState(undefined, '2026-11-12').location
        ).toBeUndefined()
    })

    it('opens a stored multi-polygon of one part as a polygon, so the field can edit it', () => {
        const ring = [
            [-12, 8],
            [-11, 8],
            [-11, 9],
            [-12, 8],
        ]
        const state = initialFormState(
            heldEventSchema.parse({
                ...SAVED_VISIT,
                geometry: { type: 'MultiPolygon', coordinates: [[ring]] },
            }),
            '2026-11-12'
        )
        expect(state.location).toBe(
            JSON.stringify({ type: 'Polygon', coordinates: [ring] })
        )
        expect(isDirty(state)).toBe(false)
    })

    it('takes a location apart from the values; a change or a clear makes the form dirty', () => {
        const moved = commit(opened(), LOCATION, MOVED_POINT)
        expect(moved.location).toBe(MOVED_POINT)
        expect(moved.entered).toEqual(opened().entered)
        expect(isDirty(moved)).toBe(true)
        expect(isDirty(commit(opened(), LOCATION, null))).toBe(true)
        expect(isDirty(commit(moved, LOCATION, HELD_POINT))).toBe(false)
    })

    it('takes nothing committed while a save is unanswered, such as a location found late', () => {
        const saving = formReducer(opened(), {
            type: 'saving',
            attempt: 'save',
        })
        expect(commit(saving, LOCATION, MOVED_POINT)).toBe(saving)
        expect(commit(saving, 'labWeight01', '13')).toBe(saving)
    })

    it('after it stops waiting, takes what the save sent as maybe held, so a later save can delete it', () => {
        const fresh = initialFormState(undefined, '2026-11-12')
        let state = commit(
            commit(fresh, 'labWeight01', '13'),
            LOCATION,
            MOVED_POINT
        )
        state = formReducer(state, { type: 'saving', attempt: 'save' })
        state = formReducer(state, {
            type: 'stoppedWaiting',
            sent: {
                effective: { labWeight01: '13', labDoseMg01: '26' },
                location: MOVED_POINT,
            },
        })
        expect(state.opened.stored).toEqual({
            labWeight01: '13',
            labDoseMg01: '26',
        })
        expect(state.opened.storedLocation).toBe(MOVED_POINT)
        // Still unsaved as far as the form knows.
        expect(isDirty(state)).toBe(true)
    })

    it('keeps the last good location on a problem', () => {
        const state = commit(
            opened(),
            LOCATION,
            null,
            'Enter a latitude between -90 and 90'
        )
        expect(state.location).toBe(HELD_POINT)
        expect(state.problems.get(LOCATION)).toBe(
            'Enter a latitude between -90 and 90'
        )
    })
})

describe('category choices', () => {
    const categories = childVisitForm({ categories: true }).categories
    const funded = () =>
        initialFormState(
            heldEventSchema.parse(SAVED_FUNDED_VISIT),
            '2026-11-12',
            categories
        )

    it('opens with the options the event holds, by category', () => {
        expect(funded().categories).toEqual({
            labCatFund1: 'labCoGovt01',
            labCatOutr1: 'labCoFixed1',
        })
        expect(
            initialFormState(undefined, '2026-11-12', categories).categories
        ).toEqual({})
    })

    it('keeps a choice apart from the values, and a change makes the form dirty', () => {
        const state = formReducer(funded(), {
            type: 'committed',
            fieldId: 'labCatFund1',
            value: 'labCoNgo001',
            category: true,
        })
        expect(state.categories.labCatFund1).toBe('labCoNgo001')
        expect(state.entered).toEqual(funded().entered)
        expect(isDirty(state)).toBe(true)
        const back = formReducer(state, {
            type: 'committed',
            fieldId: 'labCatFund1',
            value: 'labCoGovt01',
            category: true,
        })
        expect(isDirty(back)).toBe(false)
    })
})

describe('toSend', () => {
    const edited = formReducer(
        commit(commit(opened(), 'labWeight01', '13'), EVENT_DATE, '2026-11-03'),
        { type: 'noted', text: 'Seen' }
    )
    const effective = { labWeight01: '13', labDoseMg01: '26' }

    it('sends what is typed, with the rules’ values and the note, completed on Complete', () => {
        expect(toSend(edited, 'save', effective)).toMatchObject({
            status: 'ACTIVE',
            eventDate: '2026-11-03',
            effective,
            note: { text: 'Seen' },
        })
        expect(toSend(edited, 'complete', effective).status).toBe('COMPLETED')
    })

    it('reopens with what DHIS2 holds, as active, and nothing typed or set by the rules', () => {
        expect(toSend(edited, 'reopen', effective)).toEqual({
            status: 'ACTIVE',
            eventDate: '2026-11-02',
            categories: {},
            location: HELD_POINT,
            effective: opened().entered,
            note: undefined,
        })
    })
})
