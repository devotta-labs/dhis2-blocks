import { createEventFormStore, selectDirty } from './store'

const open = () =>
    createEventFormStore({
        eventId: 'Evahwp3zrQ4',
        isNew: false,
        stored: { a: '1', b: '2' },
        context: { occurredAt: '2026-03-12', orgUnitId: 'm7fBMpmVpSM' },
        status: 'ACTIVE',
    })

describe('event form store', () => {
    it('commitValue undefined removes the key', () => {
        const store = open()
        store.getState().commitValue('a', undefined)
        expect(store.getState().stored).toEqual({ b: '2' })
        expect('a' in store.getState().stored).toBe(false)
        store.getState().commitValue('c', '3')
        expect(store.getState().stored).toEqual({ b: '2', c: '3' })
    })

    it('opening an event is not dirty', () => {
        expect(selectDirty(open().getState())).toBe(false)
    })

    it('changing then reverting a value is not dirty', () => {
        const store = open()
        store.getState().commitValue('a', '9')
        expect(selectDirty(store.getState())).toBe(true)
        store.getState().commitValue('a', '1')
        expect(selectDirty(store.getState())).toBe(false)
        store.getState().commitValue('b', undefined)
        expect(selectDirty(store.getState())).toBe(true)
        store.getState().commitValue('b', '2')
        expect(selectDirty(store.getState())).toBe(false)
    })

    it('note draft makes it dirty', () => {
        const store = open()
        store.getState().setNoteDraft('called the clinic')
        expect(selectDirty(store.getState())).toBe(true)
        store.getState().setNoteDraft('   ')
        expect(selectDirty(store.getState())).toBe(false)
    })

    it('a context change makes it dirty and reverting does not', () => {
        const store = open()
        store.getState().setContext({ orgUnitId: 'other' })
        expect(selectDirty(store.getState())).toBe(true)
        store.getState().setContext({ orgUnitId: 'm7fBMpmVpSM' })
        expect(selectDirty(store.getState())).toBe(false)
        store.getState().setContext({
            geometry: { type: 'Point', coordinates: [1, 2] },
        })
        expect(selectDirty(store.getState())).toBe(true)
        store.getState().setContext({ geometry: undefined })
        expect(selectDirty(store.getState())).toBe(false)
        expect('geometry' in store.getState().context).toBe(false)
    })

    it('rule changes never count: the store holds no rule state', () => {
        // Rule effects are an overlay computed outside the store, so nothing
        // a rule does can reach `stored` or make the form dirty.
        const store = open()
        expect(Object.keys(store.getState())).not.toContain('effective')
        expect(selectDirty(store.getState())).toBe(false)
    })

    it('a new event starts with the stored values it was given', () => {
        const store = createEventFormStore({
            eventId: 'Abcdefghijk',
            isNew: true,
            stored: {},
            context: {},
            status: 'ACTIVE',
        })
        expect(store.getState().isNew).toBe(true)
        expect(store.getState().eventId).toBe('Abcdefghijk')
        expect(selectDirty(store.getState())).toBe(false)
    })

    it('markAttempt records the furthest attempt and setFieldErrors keeps server errors until the field is edited', () => {
        const store = open()
        expect(store.getState().attempt).toBe('none')
        store.getState().markAttempt('save')
        expect(store.getState().attempt).toBe('save')
        store.getState().markAttempt('complete')
        expect(store.getState().attempt).toBe('complete')
        store.getState().markAttempt('save')
        expect(store.getState().attempt).toBe('complete')

        store.getState().setFieldErrors({ a: 'bad', b: 'worse' })
        store.getState().commitValue('a', '7')
        expect(store.getState().fieldErrors).toEqual({ b: 'worse' })
    })

    it('reset returns to the opened state', () => {
        const store = open()
        store.getState().commitValue('a', '9')
        store.getState().setContext({ orgUnitId: 'other' })
        store.getState().setNoteDraft('x')
        store.getState().markAttempt('complete')
        store.getState().setFieldErrors({ a: 'bad' })
        store.getState().setStatus('COMPLETED')
        store.getState().reset()
        const state = store.getState()
        expect(state.stored).toEqual({ a: '1', b: '2' })
        expect(state.context).toEqual({
            occurredAt: '2026-03-12',
            orgUnitId: 'm7fBMpmVpSM',
        })
        expect(state.noteDraft).toBe('')
        expect(state.attempt).toBe('none')
        expect(state.fieldErrors).toEqual({})
        expect(state.status).toBe('ACTIVE')
        expect(selectDirty(state)).toBe(false)
    })

    it('markSaved makes what was saved the new opened state', () => {
        const store = createEventFormStore({
            eventId: 'Abcdefghijk',
            isNew: true,
            stored: {},
            context: { occurredAt: '2026-03-12' },
            status: 'ACTIVE',
        })
        store.getState().commitValue('a', '1')
        store.getState().commitValue('hidden', 'x')
        store.getState().setNoteDraft('a note')
        store.getState().markAttempt('complete')
        store.getState().setFieldErrors({ a: 'bad' })
        store.getState().markSaved({
            stored: { a: '1' },
            context: { occurredAt: '2026-03-12', orgUnitId: 'm7fBMpmVpSM' },
            status: 'COMPLETED',
        })
        const saved = store.getState()
        expect(saved.isNew).toBe(false)
        expect(saved.stored).toEqual({ a: '1' })
        expect(saved.initialStored).toEqual({ a: '1' })
        expect(saved.context).toEqual({
            occurredAt: '2026-03-12',
            orgUnitId: 'm7fBMpmVpSM',
        })
        expect(saved.status).toBe('COMPLETED')
        expect(saved.noteDraft).toBe('')
        expect(saved.attempt).toBe('none')
        expect(saved.fieldErrors).toEqual({})
        expect(selectDirty(saved)).toBe(false)

        store.getState().commitValue('a', '2')
        store.getState().reset()
        expect(store.getState().stored).toEqual({ a: '1' })
        expect(store.getState().status).toBe('COMPLETED')
    })
})
