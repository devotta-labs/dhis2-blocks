import { describe, expect, it } from 'vitest'
import type { RequestLogEntry } from '../../network'
import { initialLabState, labReducer } from '../labState'
import { LIVE_PRESETS, PRESETS } from '../presets'

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
        expect(state.live.program).toBe(LIVE_PRESETS[0]?.program)
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

    it('restarts for a new program or server, but keeps the finder for a new composition or frame', () => {
        const server = labReducer(withRequest, {
            type: 'changeSettings',
            changes: {
                server: { ...withRequest.settings.server, matches: 9 },
            },
        })
        expect(server.preset).toBeUndefined()
        expect(server.run).toBe(1)

        const framed = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { rtl: true, width: 'phone' },
        })
        expect(framed.preset).toBeUndefined()
        expect(framed.run).toBe(0)
        expect(framed.requests).toEqual([REQUEST])

        const composed = labReducer(withRequest, {
            type: 'changeComposition',
            composition: { ...withRequest.settings.composition, hint: false },
        })
        expect(composed.settings.composition.hint).toBe(false)
        expect(composed.run).toBe(0)
    })

    it('composes the live finder apart from the lab one', () => {
        const live = labReducer(initialLabState(), {
            type: 'switchMode',
            mode: 'live',
        })
        const composed = labReducer(live, {
            type: 'changeComposition',
            composition: { ...live.live.composition, hint: false },
        })
        expect(composed.live.composition.hint).toBe(false)
        expect(composed.settings.composition.hint).toBe(true)
    })

    it('starts a live program with its forms and no attributes until it loads', () => {
        const state = labReducer(initialLabState(), {
            type: 'liveAttributes',
            attributes: [{ id: 'a', label: 'A', valueType: 'TEXT' }],
        })
        const picked = labReducer(state, {
            type: 'pickLiveProgram',
            preset: { program: 'abcdefghijk', forms: [[]] },
        })
        expect(picked.live).toMatchObject({
            program: 'abcdefghijk',
            attributes: [],
        })
        expect(picked.live.composition.forms).toEqual([[]])
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
