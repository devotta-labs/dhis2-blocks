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
    request: { resource: 'tracker/events' },
    outcome: 'ok',
}

const withRequest = labReducer(initialLabState(), {
    type: 'logRequests',
    update: (entries) => [...entries, REQUEST],
})

describe('the tracker data entry lab state', () => {
    it('opens on the first preset in lab data', () => {
        const state = initialLabState()
        expect(state.mode).toBe('lab')
        expect(state.preset).toBe(PRESETS[0]?.name)
        expect(state.settings).toEqual(PRESETS[0]?.settings)
        expect(state.run).toBe(0)
    })

    it('opens on the linked preset, or the first for a name it does not know', () => {
        expect(initialLabState('Immunisation register').settings.example).toBe(
            'immunisation'
        )
        expect(initialLabState('Nothing like this').preset).toBe(
            PRESETS[0]?.name
        )
    })

    it('restarts on a preset, with its settings and no old requests', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('A row DHIS2 refuses'),
        })
        expect(state.preset).toBe('A row DHIS2 refuses')
        expect(state.settings.refuse).toBe(true)
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
    })

    it('restarts for an option, but keeps the run when only the network changes', () => {
        const rules = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { rules: false },
        })
        expect(rules.preset).toBeUndefined()
        expect(rules.settings.rules).toBe(false)
        expect(rules.run).toBe(1)

        const network = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { network: { delay: 2000, endpoints: {} } },
        })
        expect(network.preset).toBeUndefined()
        expect(network.settings.network.delay).toBe(2000)
        expect(network.run).toBe(0)
        expect(network.requests).toEqual([REQUEST])
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
