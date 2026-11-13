import { describe, expect, it } from 'vitest'
import type { RequestLogEntry } from '../../network'
import { generateLabData } from '../labData'
import { answer } from '../labServer'
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
    request: { resource: 'me' },
    outcome: 'ok',
}

const withRequest = labReducer(initialLabState(), {
    type: 'logRequests',
    update: (entries) => [...entries, REQUEST],
})

describe('the clinic selector lab state', () => {
    it('opens on Three clinics, or on the linked preset', () => {
        expect(initialLabState().preset).toBe('Three clinics')
        expect(initialLabState('Nothing like this').preset).toBe(
            'Three clinics'
        )
        expect(initialLabState('One clinic').settings).toEqual(
            presetNamed('One clinic').settings
        )
    })

    it('replaces the settings on a preset, restarts and seeds afresh', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('District nurse'),
        })
        expect(state.preset).toBe('District nurse')
        expect(state.settings).toEqual(presetNamed('District nurse').settings)
        expect(state.run).toBe(withRequest.run + 1)
        expect(state.seeding).toBe(withRequest.seeding + 1)
        expect(Object.keys(state.seed)).toEqual(['u1'])
        expect(state.requests).toEqual([])

        const plain = labReducer(state, {
            type: 'pickPreset',
            preset: presetNamed('Three clinics'),
        })
        expect(plain.seed).toEqual({})
        expect(plain.seeding).toBe(state.seeding + 1)
    })

    it('restarts the block when a data setting changes', () => {
        const state = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { assignedClinics: 9 },
        })
        expect(state.preset).toBeUndefined()
        expect(state.run).toBe(withRequest.run + 1)
        expect(state.requests).toEqual([])
        expect(state.seeding).toBe(withRequest.seeding)
    })

    it('keeps the block running when the sidebar collapses, the label or the value changes', () => {
        for (const changes of [
            { collapsed: true },
            { label: 'Facility' as const },
            { value: 'outside' as const },
        ]) {
            const state = labReducer(withRequest, {
                type: 'changeSettings',
                changes,
            })
            expect(state.run).toBe(withRequest.run)
            expect(state.requests).toEqual([REQUEST])
        }
    })

    it('restarts without reseeding when the lab edits storage by hand', () => {
        const state = labReducer(withRequest, { type: 'editStorage' })
        expect(state.run).toBe(withRequest.run + 1)
        expect(state.preset).toBeUndefined()
        expect(state.seed).toEqual({})
        expect(state.seeding).toBe(withRequest.seeding)
    })

    it('logs callbacks until cleared', () => {
        const state = labReducer(withRequest, {
            type: 'logCallback',
            entry: 'onValueChange Kasana CHC',
        })
        expect(state.callbacks).toEqual(['onValueChange Kasana CHC'])
        expect(labReducer(state, { type: 'clearCallbacks' }).callbacks).toEqual(
            []
        )
    })

    it('has unique names, the edge cases folded', () => {
        expect(new Set(PRESETS.map(({ name }) => name)).size).toBe(
            PRESETS.length
        )
        expect(
            PRESETS.filter(({ folded }) => folded).every(
                ({ group }) => group === 'Edge cases'
            )
        ).toBe(true)
    })

    it.each(PRESETS.map((preset) => [preset.name, preset] as const))(
        '%s gives settings the server answers',
        (_, preset) => {
            const respond = answer(
                preset.settings,
                generateLabData(preset.settings)
            )
            expect(() => respond({ resource: 'me' })).not.toThrow()
            expect(() =>
                respond({
                    resource: 'organisationUnits',
                    params: { query: 'a', pageSize: 50 },
                })
            ).not.toThrow()
            expect(() =>
                respond({
                    resource: 'organisationUnits',
                    params: { filter: 'id:in:[labFlat0001]', paging: false },
                })
            ).not.toThrow()
        }
    )
})
