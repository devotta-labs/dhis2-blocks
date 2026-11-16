import { describe, expect, it } from 'vitest'
import type { RequestLogEntry } from '../../network'
import { FILLED } from '../labData'
import { initialLabState, labReducer } from '../labState'
import { PRESETS } from '../presets'

const presetNamed = (name: string) => {
    const found = PRESETS.find((preset) => preset.name === name)
    if (!found) throw new Error(`No preset ${name}`)
    return found
}

const REQUEST: RequestLogEntry = {
    id: 1,
    at: '10:00:00',
    started: 0,
    request: { resource: 'organisationUnits' },
    outcome: 'ok',
}

const withRequest = labReducer(initialLabState(), {
    type: 'logRequests',
    update: (entries) => [...entries, REQUEST],
})

describe('the value input lab state', () => {
    it('opens on the first preset, empty, in lab data', () => {
        const state = initialLabState()
        expect(state.mode).toBe('lab')
        expect(state.preset).toBe(PRESETS[0]?.name)
        expect(state.values).toEqual({})
        expect(state.run).toBe(0)
    })

    it('opens on the linked preset with its values, or the first for a name it does not know', () => {
        expect(initialLabState('Filled in').values).toEqual(FILLED)
        expect(initialLabState('Nothing like this').preset).toBe(
            PRESETS[0]?.name
        )
    })

    it('restarts on a preset, with its settings and values and no old requests', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('Read-only'),
        })
        expect(state.settings.readOnly).toBe(true)
        expect(state.values).toEqual(FILLED)
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
    })

    it('changes props in place, and restarts for new values or a new network', () => {
        const typed = labReducer(withRequest, {
            type: 'changed',
            field: 'NUMBER',
            value: '61',
        })
        const required = labReducer(typed, {
            type: 'changeSettings',
            changes: { required: true, calendar: 'nepali' },
        })
        expect(required.preset).toBeUndefined()
        expect(required.run).toBe(0)
        expect(required.values).toEqual({ NUMBER: '61' })
        expect(required.requests).toEqual([REQUEST])

        const filled = labReducer(typed, {
            type: 'changeSettings',
            changes: { filled: true },
        })
        expect(filled.run).toBe(1)
        expect(filled.values).toEqual(FILLED)
    })

    it('keeps a committed value, keeps the last good one after a problem, and logs every call', () => {
        const committed = labReducer(withRequest, {
            type: 'changed',
            field: 'NUMBER',
            value: '62.5',
        })
        const problem = labReducer(committed, {
            type: 'changed',
            field: 'NUMBER',
            value: null,
            problem: { message: 'Enter a number', text: 'abc' },
        })
        const cleared = labReducer(problem, {
            type: 'changed',
            field: 'TEXT',
            value: null,
        })
        expect(problem.values.NUMBER).toBe('62.5')
        expect(cleared.values).toEqual({ NUMBER: '62.5', TEXT: undefined })
        expect(cleared.callbacks).toEqual([
            'Full name (TEXT): onChange(null)',
            'Weight (NUMBER): onChange(null, {"message":"Enter a number","text":"abc"})',
            'Weight (NUMBER): onChange("62.5")',
        ])
        expect(
            labReducer(cleared, { type: 'clearCallbacks' }).callbacks
        ).toEqual([])
    })

    it('restarts when switching to live DHIS2, keeping the settings', () => {
        const state = labReducer(withRequest, {
            type: 'switchMode',
            mode: 'live',
        })
        expect(state.mode).toBe('live')
        expect(state.settings).toBe(withRequest.settings)
        expect(state.run).toBe(1)
    })
})
