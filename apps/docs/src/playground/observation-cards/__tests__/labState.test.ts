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

describe('the observation cards lab state', () => {
    it('opens on the first preset in lab data', () => {
        const state = initialLabState()
        expect(state.mode).toBe('lab')
        expect(state.preset).toBe(PRESETS[0]?.name)
        expect(state.settings).toEqual(PRESETS[0]?.settings)
        expect(state.run).toBe(0)
    })

    it('opens on the linked preset, or the first for a name it does not know', () => {
        expect(initialLabState('Stale').settings).toEqual(
            presetNamed('Stale').settings
        )
        expect(initialLabState('Nothing like this').preset).toBe(
            PRESETS[0]?.name
        )
    })

    it('restarts on a preset, with its settings and no old requests', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('One reading'),
        })
        expect(state.preset).toBe('One reading')
        expect(state.settings.visits).toBe(1)
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
    })

    it('leaves the preset on a change by hand, restarting only for new data', () => {
        const visits = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { visits: 3 },
        })
        expect(visits.preset).toBeUndefined()
        expect(visits.settings.visits).toBe(3)
        expect(visits.run).toBe(1)

        const layout = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { cardWidth: 200, cardsPerRow: 2 },
        })
        expect(layout.preset).toBeUndefined()
        expect(layout.run).toBe(0)
        expect(layout.requests).toEqual([REQUEST])
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

    it('changes live ids without restarting', () => {
        const state = labReducer(withRequest, {
            type: 'changeLive',
            changes: { dataElementId: 'abc123def45' },
        })
        expect(state.live.dataElementId).toBe('abc123def45')
        expect(state.live.personId).toBe('Y8aEiTpHSSQ')
        expect(state.run).toBe(0)
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
