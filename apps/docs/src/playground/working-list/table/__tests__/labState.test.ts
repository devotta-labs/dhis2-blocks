import { describe, expect, it } from 'vitest'
import type { RequestLogEntry } from '../../../network'
import { initialLabState, labReducer, type LabAction } from '../labState'
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

const withLogs: LabAction[] = [
    { type: 'logRequests', update: () => [REQUEST] },
    { type: 'noteCallback', entry: 'onRowClick' },
]
const logged = withLogs.reduce(labReducer, initialLabState())

describe('the working list table lab state', () => {
    it('opens on the first preset in lab data, full width', () => {
        const state = initialLabState()
        expect(state.mode).toBe('lab')
        expect(state.preset).toBe(PRESETS[0]?.name)
        expect(state.config).toEqual(PRESETS[0]?.config)
        expect(state.width).toBe('full')
    })

    it('opens on the linked preset, or the first for a name it does not know', () => {
        expect(initialLabState('No records').config.data.records).toBe(0)
        expect(initialLabState('Nothing like this').preset).toBe(
            PRESETS[0]?.name
        )
    })

    it('restarts on a preset, with its config and no old logs', () => {
        const state = labReducer(logged, {
            type: 'pickPreset',
            preset: presetNamed('Follow-up visits'),
        })
        expect(state.preset).toBe('Follow-up visits')
        expect(state.config.data.mode).toBe('event')
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
        expect(state.callbacks).toEqual([])
    })

    it('applies a view in place, and leaves the preset', () => {
        const view = { ...logged.config.view, pageSize: 50 as const }
        const state = labReducer(logged, { type: 'changeView', view })
        expect(state.preset).toBeUndefined()
        expect(state.config.view).toEqual(view)
        expect(state.run).toBe(0)
        expect(state.requests).toEqual([REQUEST])
    })

    it('restarts on a new network, and leaves the preset', () => {
        const network = { delay: 2000, endpoints: {} }
        const state = labReducer(logged, { type: 'changeNetwork', network })
        expect(state.preset).toBeUndefined()
        expect(state.config.network).toEqual(network)
        expect(state.run).toBe(1)
        expect(state.requests).toEqual([])
        expect(state.callbacks).toEqual(['onRowClick'])
    })

    it('keeps the config when switching to live DHIS2, and restarts', () => {
        const state = labReducer(logged, { type: 'switchMode', mode: 'live' })
        expect(state.mode).toBe('live')
        expect(state.config).toBe(logged.config)
        expect(state.run).toBe(1)
    })

    it('changes live ids and the width without restarting', () => {
        const actions: LabAction[] = [
            { type: 'changeLive', changes: { orgUnitId: 'DiszpKrYNg8' } },
            { type: 'changeWidth', width: 'phone' },
        ]
        const state = actions.reduce(labReducer, logged)
        expect(state.live).toEqual({
            programId: 'IpHINAT79UW',
            orgUnitId: 'DiszpKrYNg8',
        })
        expect(state.width).toBe('phone')
        expect(state.run).toBe(0)
    })

    it('keeps the newest 80 callbacks, newest first', () => {
        const notes = Array.from({ length: 90 }, (_, index): LabAction => ({
            type: 'noteCallback',
            entry: `call ${index}`,
        }))
        const state = notes.reduce(labReducer, initialLabState())
        expect(state.callbacks).toHaveLength(80)
        expect(state.callbacks[0]).toBe('call 89')
        expect(labReducer(state, { type: 'clearCallbacks' }).callbacks).toEqual(
            []
        )
    })
})
