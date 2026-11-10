import { describe, expect, it } from 'vitest'
import type { RequestLogEntry } from '../../network'
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
    request: { resource: 'tracker/trackedEntities' },
    outcome: 'ok',
}

const withRequest = labReducer(initialLabState(), {
    type: 'logRequests',
    update: (entries) => [...entries, REQUEST],
})

describe('the tracked entity header lab state', () => {
    it('opens on the first preset, in lab data, on the banner', () => {
        const state = initialLabState()
        expect(state.mode).toBe('lab')
        expect(state.canvas).toBe('banner')
        expect(state.preset).toBe(PRESETS[0]?.name)
        expect(state.settings).toEqual(PRESETS[0]?.settings)
        expect(state.run).toBe(0)
    })

    it('opens on the linked preset, or the first for a name it does not know', () => {
        expect(initialLabState('Restricted').settings).toEqual(
            presetNamed('Restricted').settings
        )
        expect(initialLabState('Nothing like this').preset).toBe(
            PRESETS[0]?.name
        )
    })

    it('restarts on a preset, with its settings and no old requests', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('Inactive'),
        })
        expect(state.preset).toBe('Inactive')
        expect(state.settings.inactive).toBe(true)
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
    })

    it('switches canvas without restarting or losing the preset', () => {
        const state = labReducer(withRequest, {
            type: 'switchCanvas',
            canvas: 'quick-look',
        })
        expect(state.canvas).toBe('quick-look')
        expect(state.preset).toBe(withRequest.preset)
        expect(state.run).toBe(0)
        expect(state.requests).toEqual([REQUEST])
    })

    it('restarts on a new person, and leaves width alone in place', () => {
        const person = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { person: 'adult' },
        })
        expect(person.preset).toBeUndefined()
        expect(person.run).toBe(1)
        expect(person.requests).toEqual([])

        const width = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { width: 'narrow' },
        })
        expect(width.run).toBe(0)
        expect(width.requests).toEqual([REQUEST])
    })

    it('keeps the settings when switching to live DHIS2, and restarts', () => {
        const state = labReducer(withRequest, {
            type: 'switchMode',
            mode: 'live',
        })
        expect(state.mode).toBe('live')
        expect(state.settings).toBe(withRequest.settings)
        expect(state.run).toBe(1)
    })

    it('changes live ids by restarting, since the person is new', () => {
        const state = labReducer(withRequest, {
            type: 'changeLive',
            changes: { personId: 'abc123def45' },
        })
        expect(state.live.personId).toBe('abc123def45')
        expect(state.run).toBe(1)
    })

    it('logs requests until a restart or a clear', () => {
        expect(withRequest.requests).toEqual([REQUEST])
        expect(
            labReducer(withRequest, { type: 'clearRequests' }).requests
        ).toEqual([])
        expect(labReducer(withRequest, { type: 'restart' }).requests).toEqual(
            []
        )
    })
})
