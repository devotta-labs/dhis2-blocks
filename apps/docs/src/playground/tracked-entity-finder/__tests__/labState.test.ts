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

describe('the finder lab state', () => {
    it('opens on the first preset in lab data', () => {
        const state = initialLabState()
        expect(state.mode).toBe('lab')
        expect(state.preset).toBe(PRESETS[0]?.name)
        expect(state.settings).toEqual(PRESETS[0]?.settings)
        expect(state.live.programId).toBe('WSGAb5XwJ3Y')
    })

    it('opens on the linked preset, or the first for a name it does not know', () => {
        expect(initialLabState('Many pages').preset).toBe('Many pages')
        expect(initialLabState('Nothing like this').preset).toBe(
            PRESETS[0]?.name
        )
    })

    it('restarts on a preset, with its settings and no old requests', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('No one found'),
        })
        expect(state.settings.server.matches).toBe(0)
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
    })

    it('restarts for a changed option, and leaves the example', () => {
        const state = labReducer(withRequest, {
            type: 'changeSettings',
            changes: {
                server: { ...withRequest.settings.server, matches: 9 },
            },
        })
        expect(state.preset).toBeUndefined()
        expect(state.settings.server.matches).toBe(9)
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
    })

    it('changes the live program without restarting', () => {
        const state = labReducer(initialLabState(), {
            type: 'changeLive',
            changes: { programId: 'abcdefghijk' },
        })
        expect(state.live.programId).toBe('abcdefghijk')
        expect(state.run).toBe(0)
    })

    it('has a unique name for every example', () => {
        const names = PRESETS.map(({ name }) => name)
        expect(new Set(names).size).toBe(names.length)
    })

    it('logs each selection, newest first', () => {
        const once = labReducer(initialLabState(), {
            type: 'selected',
            person: { trackedEntity: 'one' },
        })
        const twice = labReducer(once, {
            type: 'selected',
            person: { trackedEntity: 'two' },
        })
        expect(twice.callbacks[0]).toContain('two')
        expect(labReducer(twice, { type: 'clearCallbacks' }).callbacks).toEqual(
            []
        )
    })
})
