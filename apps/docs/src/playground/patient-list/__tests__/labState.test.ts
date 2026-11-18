import { describe, expect, it } from 'vitest'
import type { RequestLogEntry } from '../../network'
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
    { type: 'noteCallback', entry: 'onRowOpen("labTe000001")' },
]
const logged = withLogs.reduce(labReducer, initialLabState())

describe('the patient list lab state', () => {
    it('opens on the first preset in lab data, full width', () => {
        const state = initialLabState()
        expect(state.mode).toBe('lab')
        expect(state.preset).toBe('Default')
        expect(state.config).toEqual(PRESETS[0]?.config)
        expect(state.width).toBe('full')
        expect(state.live).toEqual({
            programId: 'IpHINAT79UW',
            orgUnitId: 'DiszpKrYNg8',
        })
    })

    it('opens on the linked preset, or the first for a name it does not know', () => {
        expect(initialLabState('Empty list').config.data.rows).toBe(0)
        expect(initialLabState('Nothing like this').preset).toBe('Default')
    })

    it('has the presets the docs describe', () => {
        expect(PRESETS.map(({ name }) => name)).toEqual([
            'Default',
            'Large page',
            'Bulk selection',
            'Bare table',
            'Empty list',
            'Slow server',
            'Server error',
            'Malformed response',
        ])
        expect(presetNamed('Large page').config.view.pageSize).toBe(50)
        expect(presetNamed('Large page').config.data.rows).toBe(500)
        expect(presetNamed('Bulk selection').config.view.selection).toBe(true)
        const bare = presetNamed('Bare table').config.view
        expect([bare.filters, bare.columnSettings, bare.density]).toEqual([
            false,
            false,
            false,
        ])
        expect(
            presetNamed('Server error').config.network.endpoints[
                'tracker/trackedEntities'
            ]?.behaviour
        ).toBe('fails')
        expect(presetNamed('Malformed response').config.server.response).toBe(
            'malformed'
        )
    })

    it('restarts on a preset, with its config and no old logs', () => {
        const state = labReducer(logged, {
            type: 'pickPreset',
            preset: presetNamed('Slow server'),
        })
        expect(state.preset).toBe('Slow server')
        expect(state.config.network.delay).toBe(2000)
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
        expect(state.callbacks).toEqual(['onRowOpen("labTe000001")'])
    })

    it('keeps the config when switching to live DHIS2, and restarts', () => {
        const state = labReducer(logged, { type: 'switchMode', mode: 'live' })
        expect(state.mode).toBe('live')
        expect(state.config).toBe(logged.config)
        expect(state.run).toBe(1)
    })

    it('changes live ids and the width without restarting', () => {
        const actions: LabAction[] = [
            { type: 'changeLive', changes: { orgUnitId: 'ImspTQPwCqd' } },
            { type: 'changeWidth', width: 'phone' },
        ]
        const state = actions.reduce(labReducer, logged)
        expect(state.live).toEqual({
            programId: 'IpHINAT79UW',
            orgUnitId: 'ImspTQPwCqd',
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
