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

describe('the timeline lab state', () => {
    it('opens on the first preset in lab data', () => {
        const state = initialLabState()
        expect(state.mode).toBe('lab')
        expect(state.preset).toBe(PRESETS[0]?.name)
        expect(state.settings).toEqual(PRESETS[0]?.settings)
        expect(state.run).toBe(0)
    })

    it('opens on the linked preset, or the first for a name it does not know', () => {
        expect(initialLabState('Events fail').settings).toEqual(
            presetNamed('Events fail').settings
        )
        expect(initialLabState('Case history').preset).toBe(PRESETS[0]?.name)
    })

    it('restarts on a preset, with its settings and no old requests', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('Changes fail'),
        })
        expect(state.preset).toBe('Changes fail')
        expect(state.settings.failing).toBe('changes')
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
    })

    it('leaves the preset on a change by hand, restarting unless only the language changed', () => {
        const timeField = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { timeField: 'scheduledAt' },
        })
        expect(timeField.preset).toBeUndefined()
        expect(timeField.settings.timeField).toBe('scheduledAt')
        expect(timeField.run).toBe(1)
        expect(timeField.requests).toEqual([])

        const locale = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { locale: 'ar' },
        })
        expect(locale.preset).toBeUndefined()
        expect(locale.run).toBe(0)
        expect(locale.requests).toEqual([REQUEST])
    })

    it('keeps the settings when switching to live DHIS2, and restarts', () => {
        const state = labReducer(withRequest, {
            type: 'switchMode',
            mode: 'live',
        })
        expect(state.mode).toBe('live')
        expect(state.preset).toBe(withRequest.preset)
        expect(state.settings).toBe(withRequest.settings)
        expect(state.run).toBe(1)
    })

    it('changes live ids without restarting', () => {
        const state = labReducer(withRequest, {
            type: 'changeLive',
            changes: { programs: 'IpHINAT79UW' },
        })
        expect(state.live).toEqual({
            trackedEntity: 'Y8aEiTpHSSQ',
            programs: 'IpHINAT79UW',
        })
        expect(state.run).toBe(0)
    })

    it('logs requests until a restart or a clear', () => {
        expect(withRequest.requests).toEqual([REQUEST])
        expect(
            labReducer(withRequest, { type: 'clearRequests' }).requests
        ).toEqual([])
        const restarted = labReducer(withRequest, { type: 'restart' })
        expect(restarted.requests).toEqual([])
        expect(restarted.run).toBe(1)
    })
})
