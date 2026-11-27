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
    request: { resource: 'programs' },
    outcome: 'ok',
}

const withRequest = labReducer(initialLabState(), {
    type: 'logRequests',
    update: (entries) => [...entries, REQUEST],
})

describe('the event form lab state', () => {
    it('opens on the first preset in lab data', () => {
        const state = initialLabState()
        expect(state.mode).toBe('lab')
        expect(state.preset).toBe('New child visit')
        expect(state.settings).toEqual(PRESETS[0]?.settings)
        expect(state.run).toBe(0)
        expect(state.callbacks).toEqual([])
    })

    it('opens on the linked preset, or the first for a name it does not know', () => {
        expect(
            initialLabState({ preset: 'RMNCH First ANC' }).settings.example
        ).toBe('rmnch')
        expect(initialLabState({ preset: 'Nothing like this' }).preset).toBe(
            'New child visit'
        )
    })

    it('restarts on a preset, with its settings and no old requests', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('DHIS2 refuses the save'),
        })
        expect(state.preset).toBe('DHIS2 refuses the save')
        expect(state.settings.example).toBe('refused')
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
    })

    it('keeps the run for a network or blame change, and restarts for another example', () => {
        const network = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { network: { delay: 2000, endpoints: {} } },
        })
        expect(network.preset).toBeUndefined()
        expect(network.run).toBe(0)
        expect(network.requests).toEqual([REQUEST])

        const blame = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { blame: 'off' },
        })
        expect(blame.settings.blame).toBe('off')
        expect(blame.run).toBe(0)

        const example = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { example: 'longForm' },
        })
        expect(example.settings.example).toBe('longForm')
        expect(example.run).toBe(1)
        expect(example.requests).toEqual([])
    })

    it('logs the callbacks newest first, until cleared', () => {
        const dirty = labReducer(withRequest, {
            type: 'called',
            callback: 'onDirtyChange',
            value: true,
        })
        const saved = labReducer(dirty, {
            type: 'called',
            callback: 'onSaved',
            value: { eventId: 'labVisit001', status: 'ACTIVE' },
        })
        expect(saved.callbacks).toEqual([
            'onSaved({"eventId":"labVisit001","status":"ACTIVE"})',
            'onDirtyChange(true)',
        ])
        expect(labReducer(saved, { type: 'clearCallbacks' }).callbacks).toEqual(
            []
        )
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

    it('logs requests until a restart or a clear', () => {
        expect(withRequest.requests).toEqual([REQUEST])
        expect(
            labReducer(withRequest, { type: 'clearRequests' }).requests
        ).toEqual([])
        expect(labReducer(withRequest, { type: 'restart' }).requests).toEqual(
            []
        )
    })

    it('changes a host setting in place', () => {
        const state = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { confirmSaved: 'off', locationWarnKm: 25 },
        })
        expect(state.settings).toMatchObject({
            confirmSaved: 'off',
            locationWarnKm: 25,
        })
        expect(state.run).toBe(0)
    })

    it('checks the location against an org unit area in its preset', () => {
        expect(
            presetNamed('Location in an org unit area').settings.locationWarnKm
        ).toBe(100)
        expect(
            presetNamed('New visit with a location').settings.locationWarnKm
        ).toBeUndefined()
    })
})
